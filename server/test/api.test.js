// Smoke tests. Run: npm test
// Uses a throwaway data dir so your real database is never touched.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "myhub-test-"));
process.env.HUB_DATA_DIR = tmpDir;

let server, base;

before(async () => {
  const { app } = await import("../app.js");
  await import("../scripts/seed.js");
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => {
  server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const get = async (p) => {
  const res = await fetch(base + p);
  return { status: res.status, body: await res.json() };
};

test("health", async () => {
  const { body } = await get("/health");
  assert.equal(body.status, "ok");
  assert.equal(body.conversations, 2);
});

test("list + provider filter", async () => {
  assert.equal((await get("/conversations")).body.length, 2);
  assert.equal((await get("/conversations?provider=claude")).body.length, 1);
});

test("search titles and message text", async () => {
  assert.equal((await get("/conversations?q=hooks")).body[0].title, "Learning React hooks");
  assert.equal((await get("/conversations?q=useEff")).body.length, 1); // prefix match in messages
});

test("weird search input does not crash", async () => {
  const { status } = await get("/conversations?q=" + encodeURIComponent('"AND( * NEAR'));
  assert.equal(status, 200);
});

test("conversation detail: ordered messages + multiple links", async () => {
  const { body } = await get("/conversations/1");
  assert.deepEqual(body.messages.map((m) => m.sequence_number), [1, 2]);
  assert.equal(body.notebooks.length, 2); // linked twice, stored once
});

test("404s", async () => {
  assert.equal((await get("/conversations/999")).status, 404);
  assert.equal((await get("/conversations/abc")).status, 404);
  assert.equal((await get("/nope")).status, 404);
});
