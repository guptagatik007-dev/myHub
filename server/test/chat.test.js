import { test, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setupTestServer } from "./helpers.js";

// Stand-in for the venv python: a node script that ignores "-m mlx_lm server" and fakes the API.
process.env.LOCAL_MODEL_PYTHON = path.join(path.dirname(fileURLToPath(import.meta.url)), "fake-python.js");
process.env.LOCAL_MODEL_PORT = String(18000 + Math.floor(Math.random() * 1000));
process.env.LOCAL_MODEL = "test-model";

const t = setupTestServer({ seed: true });
after(async () => (await import("../services/localModel.js")).stop());

test("chat: starts model on demand, saves both messages with model name, multi-turn", async () => {
  assert.equal((await t.api("GET", "/local-model")).body.status, "stopped");

  const { id } = (await t.api("POST", "/chats")).body;
  const r1 = await t.api("POST", `/chats/${id}/messages`, { content: "Hello there" });
  assert.equal(r1.status, 200);
  assert.equal(r1.body.assistantMessage.model_name, "test-model");
  assert.equal(r1.body.assistantMessage.content, "Echo (1 msgs, thinking=false): Hello there"); // <think> stripped
  assert.equal(JSON.parse(r1.body.assistantMessage.metadata_json).reasoning, "pondering");
  assert.equal((await t.api("GET", "/local-model")).body.status, "ready");

  const r2 = await t.api("POST", `/chats/${id}/messages`, { content: "Again" });
  assert.match(r2.body.assistantMessage.content, /3 msgs/); // full history sent

  const conv = (await t.api("GET", `/conversations/${id}`)).body;
  assert.equal(conv.title, "Hello there");
  assert.equal(conv.provider, "hub");
  assert.deepEqual(conv.messages.map((m) => m.role), ["user", "assistant", "user", "assistant"]);
  assert.equal((await t.api("GET", "/conversations?q=Echo")).body.length, 1); // searchable
});

test("imported conversations are read-only; bad input rejected", async () => {
  assert.equal((await t.api("POST", "/chats/1/messages", { content: "hi" })).status, 400); // seeded claude conv
  const { id } = (await t.api("POST", "/chats")).body;
  assert.equal((await t.api("POST", `/chats/${id}/messages`, { content: "" })).status, 400);
  assert.equal((await t.api("POST", `/chats/999/messages`, { content: "x" })).status, 404);
});

test("model failure: clear error, your message is still saved", async () => {
  const lm = await import("../services/localModel.js");
  lm.stop();
  const saved = process.env.LOCAL_MODEL_PYTHON;
  process.env.LOCAL_MODEL_PYTHON = "/nope/python";
  const portSaved = process.env.LOCAL_MODEL_PORT;
  process.env.LOCAL_MODEL_PORT = String(Number(portSaved) + 1); // nothing listening there

  const { id } = (await t.api("POST", "/chats")).body;
  const r = await t.api("POST", `/chats/${id}/messages`, { content: "Are you there?" });
  assert.equal(r.status, 503);
  assert.match(r.body.error, /not found/);
  const conv = (await t.api("GET", `/conversations/${id}`)).body;
  assert.equal(conv.messages.length, 1);

  process.env.LOCAL_MODEL_PYTHON = saved;
  process.env.LOCAL_MODEL_PORT = portSaved;
  lm.stop();
});
