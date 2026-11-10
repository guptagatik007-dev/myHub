// Starts/stops a local MLX model server and talks to it.
// mlx_lm.server speaks the OpenAI-style /v1/chat/completions API.
import { spawn } from "node:child_process";
import fs from "node:fs";

const cfg = () => ({
  python: process.env.LOCAL_MODEL_PYTHON || "",
  model: process.env.LOCAL_MODEL || "mlx-community/Qwen3.5-9B-MLX-4bit",
  port: Number(process.env.LOCAL_MODEL_PORT || 8080),
  maxTokens: Number(process.env.LOCAL_MODEL_MAX_TOKENS || 1024),
  thinking: process.env.LOCAL_MODEL_THINKING === "true",
  startTimeoutMs: Number(process.env.LOCAL_MODEL_START_TIMEOUT_MS || 180000),
});

// status: stopped | starting | ready | error
const state = { status: "stopped", error: null, startedAt: null, child: null, starting: null, log: [], model: null };

const baseUrl = () => `http://127.0.0.1:${cfg().port}`;

export function getStatus() {
  const { python, model, port } = cfg();
  return {
    status: state.status, error: state.error,
    model: state.model || model, // running model, or the default
    port, python, configured: Boolean(python), startedAt: state.startedAt,
  };
}

async function isHealthy() {
  try {
    const res = await fetch(`${baseUrl()}/health`, { signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Start the model server (with `model`, default from config) if needed.
 * If a different model is running, it's stopped first. Resolves when ready.
 */
export async function start(model = cfg().model) {
  if (state.starting) await state.starting.catch(() => {}); // let an in-progress start finish first
  if (state.status === "ready" && state.model === model) return getStatus();
  if (state.status === "ready" || state.child) stop(); // switching models
  state.starting = doStart(model).finally(() => { state.starting = null; });
  return state.starting;
}

async function doStart(model) {
  const { python, port, startTimeoutMs } = cfg();
  state.model = model;

  // Something already answering on the port (e.g. started by hand, or still shutting down)?
  // Only reuse it if we didn't just stop it — otherwise wait for the port to free up.
  if (await isHealthy()) {
    if (!state.stoppedAt || Date.now() - state.stoppedAt > 10000) {
      Object.assign(state, { status: "ready", error: null, startedAt: new Date().toISOString() });
      return getStatus();
    }
    const freeBy = Date.now() + 10000;
    while (Date.now() < freeBy && (await isHealthy())) await new Promise((r) => setTimeout(r, 300));
  }

  if (!python) return fail("LOCAL_MODEL_PYTHON is not set. Add it to server/.env.");
  if (!fs.existsSync(python)) return fail(`Python not found: ${python}`);

  Object.assign(state, { status: "starting", error: null, log: [] });
  // Same as running: <venv>/bin/python -m mlx_lm server --model ... (no activation needed)
  const child = spawn(python, ["-m", "mlx_lm", "server", "--model", model, "--host", "127.0.0.1", "--port", String(port)], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  state.child = child;

  // Keep the last 30 log lines for error messages.
  const keep = (buf) => {
    state.log.push(...buf.toString().split("\n").filter(Boolean));
    state.log = state.log.slice(-30);
  };
  child.stdout.on("data", keep);
  child.stderr.on("data", keep);

  let exited = false;
  child.on("exit", (code) => {
    exited = true;
    if (state.child !== child) return; // an old process we already replaced/stopped
    state.child = null;
    if (state.status !== "stopped") {
      const tail = state.log.slice(-5).join("\n");
      fail(`Model process exited (code ${code}).${tail ? "\n" + tail : ""}`);
    }
  });
  child.on("error", (err) => fail(`Could not start model: ${err.message}`));

  // Poll /health until it answers (model loading can take a while).
  const deadline = Date.now() + startTimeoutMs;
  while (Date.now() < deadline) {
    if (exited || state.status === "error") return getStatus();
    if (await isHealthy()) {
      Object.assign(state, { status: "ready", startedAt: new Date().toISOString() });
      return getStatus();
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  stop();
  return fail(`Model did not become ready within ${Math.round(startTimeoutMs / 1000)}s.`);
}

function fail(message) {
  Object.assign(state, { status: "error", error: message });
  return getStatus();
}

export function stop() {
  const child = state.child;
  Object.assign(state, { status: "stopped", error: null, startedAt: null, child: null, stoppedAt: child ? Date.now() : state.stoppedAt });
  if (child && child.exitCode === null) child.kill("SIGTERM");
  return getStatus();
}

/**
 * Send a conversation to the model.
 * messages: [{ role: "user" | "assistant" | "system", content }]
 * Returns { content, reasoning, model, usage }.
 */
export async function chat(messages, model = cfg().model) {
  const status = await start(model);
  if (status.status !== "ready") throw Object.assign(new Error(status.error || "Model not ready"), { status: 503 });

  const { maxTokens, thinking } = cfg();
  const res = await fetch(`${baseUrl()}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "default_model", // the model the server was started with
      messages,
      max_tokens: maxTokens,
      chat_template_kwargs: { enable_thinking: thinking },
    }),
    signal: AbortSignal.timeout(10 * 60 * 1000),
  });
  if (!res.ok) {
    throw Object.assign(new Error(`Model error (${res.status}): ${(await res.text()).slice(0, 300)}`), { status: 502 });
  }
  const data = await res.json();
  const msg = data.choices?.[0]?.message || {};
  let content = msg.content || "";
  let reasoning = msg.reasoning || null;

  // Some models put thinking inline as <think>…</think>; keep it out of the answer.
  const m = content.match(/^\s*<think>([\s\S]*?)<\/think>\s*/);
  if (m) { reasoning = (reasoning || "") + m[1].trim(); content = content.slice(m[0].length); }

  return { content: content.trim(), reasoning, model, usage: data.usage || null, finish_reason: data.choices?.[0]?.finish_reason };
}

// Don't leave the model running when MyHub stops.
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => { stop(); process.exit(0); });
}
process.on("exit", () => { if (state.child) state.child.kill("SIGTERM"); });
