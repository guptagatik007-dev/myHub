// Starts the app against a throwaway data dir. Each test file runs in its own process.
import { before, after } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function setupTestServer({ seed = true } = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "myhub-test-"));
  process.env.HUB_DATA_DIR = tmpDir;
  const ctx = {};
  let server;

  before(async () => {
    const { app } = await import("../app.js");
    if (seed) await import("../scripts/seed.js");
    server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    ctx.base = `http://127.0.0.1:${server.address().port}/api`;
  });

  after(() => {
    server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // api("GET", "/notebooks") -> { status, body }
  ctx.api = async (method, p, body) => {
    const res = await fetch(ctx.base + p, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  return ctx;
}
