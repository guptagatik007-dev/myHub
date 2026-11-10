// Which models can MyHub chat with?
//  - Local MLX models: anything chat-capable in the Hugging Face cache.
//  - Cloud providers: listed so the picker shows them, not available yet.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const hfCacheDir = () =>
  process.env.HF_HUB_CACHE ||
  (process.env.HF_HOME ? path.join(process.env.HF_HOME, "hub") : path.join(os.homedir(), ".cache", "huggingface", "hub"));

// "models--mlx-community--Qwen3.5-9B-MLX-4bit" -> "mlx-community/Qwen3.5-9B-MLX-4bit"
// Only keep repos that look like chat LLMs (config + a chat template).
function findLocalMlxModels() {
  let dirs = [];
  try { dirs = fs.readdirSync(hfCacheDir()); } catch { return []; }
  const found = [];
  for (const dir of dirs) {
    if (!dir.startsWith("models--")) continue;
    const snapshots = path.join(hfCacheDir(), dir, "snapshots");
    let snaps = [];
    try { snaps = fs.readdirSync(snapshots); } catch { continue; }
    const isChatModel = snaps.some((s) => {
      const p = path.join(snapshots, s);
      return fs.existsSync(path.join(p, "config.json")) &&
        (fs.existsSync(path.join(p, "chat_template.jinja")) || hasChatTemplate(path.join(p, "tokenizer_config.json")));
    });
    if (isChatModel) found.push(dir.slice("models--".length).replace("--", "/"));
  }
  return found;
}

function hasChatTemplate(file) {
  try { return "chat_template" in JSON.parse(fs.readFileSync(file, "utf8")); } catch { return false; }
}

const CLOUD = [
  { id: "openai", label: "ChatGPT", group: "Cloud" },
  { id: "anthropic", label: "Claude", group: "Cloud" },
  { id: "google", label: "Gemini", group: "Cloud" },
];

export function defaultModel() {
  return process.env.LOCAL_MODEL || "mlx-community/Qwen3.5-9B-MLX-4bit";
}

/** [{ id, label, group, kind, available, note }] */
export function listModels() {
  const local = new Set(findLocalMlxModels());
  local.add(defaultModel()); // configured model always listed
  const localModels = [...local].sort().map((id) => ({
    id,
    label: id.split("/").pop(),
    group: "Local (on this Mac)",
    kind: "mlx",
    available: true,
  }));
  const cloud = CLOUD.map((m) => ({ ...m, kind: "cloud", available: false, note: "coming soon" }));
  return [...localModels, ...cloud];
}

export function findModel(id) {
  return listModels().find((m) => m.id === id) || null;
}
