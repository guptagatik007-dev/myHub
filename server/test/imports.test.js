import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { setupTestServer } from "./helpers.js";

const t = setupTestServer({ seed: false });

const upload = async (content, { provider = "chatgpt", filename = "export.json", label } = {}) => {
  const q = new URLSearchParams({ provider, filename, ...(label ? { label } : {}) });
  const res = await fetch(`${t.base}/imports?${q}`, {
    method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: content,
  });
  return { status: res.status, body: await res.json() };
};

test("upload stores an untouched, read-only original; no importer -> 'stored' + warning", async () => {
  const content = '{"hello":"world"}';
  const r = await upload(content, { label: "Personal" });
  assert.equal(r.status, 201);
  assert.equal(r.body.status, "stored");
  assert.equal(r.body.account_label, "Personal");
  assert.match(r.body.report.warnings[0], /No chatgpt importer yet/);

  const full = path.join(process.env.HUB_DATA_DIR, r.body.stored_path);
  assert.equal(fs.readFileSync(full, "utf8"), content);          // byte-identical
  assert.equal(fs.statSync(full).mode & 0o222, 0);                // not writable
  assert.ok(r.body.stored_path.startsWith(path.join("imports", "original", "chatgpt")));
});

test("same file twice -> 409, nothing stored twice", async () => {
  await upload("same-bytes-123", { filename: "a.json" });
  const r = await upload("same-bytes-123", { filename: "b.json" });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /already imported/);
});

test("rejects bad input; hostile filenames stay inside the data dir", async () => {
  assert.equal((await upload("x", { filename: "evil.exe" })).status, 400);
  assert.equal((await upload("", { filename: "empty.json" })).status, 400);
  assert.equal((await upload("x", { provider: "myspace" })).status, 400);

  const r = await upload("traversal", { filename: "../../../../etc/passwd.json" });
  assert.equal(r.status, 201);
  assert.ok(!r.body.stored_path.includes(".."));
  assert.equal(path.basename(r.body.stored_path), "passwd.json");
});

test("processing with an importer: saves, skips duplicates, isolates failures", async () => {
  const { IMPORTERS } = await import("../importers/index.js");
  const sample = (id, title) => ({
    external_id: id, title, created_at: "2026-01-01T00:00:00Z",
    messages: [{ role: "user", content: `hi ${title}` }, { role: "assistant", content: "hello", model_name: "m1" }],
  });
  IMPORTERS.other = async () => ({
    conversations: [sample("a", "First"), sample("b", "Second"), { external_id: "bad", title: "Broken", messages: null }],
    warnings: ["1 image not imported"],
  });

  const r1 = await upload("batch-one", { provider: "other" });
  assert.equal(r1.body.status, "partial");
  assert.equal(r1.body.report.imported, 2);
  assert.equal(r1.body.report.failed, 1);
  assert.equal(r1.body.report.messages, 4);
  assert.deepEqual(r1.body.report.warnings, ["1 image not imported"]);

  // A newer export containing the same conversations -> skipped, not duplicated
  const r2 = await upload("batch-two-different-bytes", { provider: "other" });
  assert.equal(r2.body.report.imported, 0);
  assert.equal(r2.body.report.skipped, 2);

  const list = (await t.api("GET", "/conversations?provider=other")).body;
  assert.equal(list.length, 2);
  const conv = (await t.api("GET", `/conversations/${list[0].id}`)).body;
  assert.equal(conv.messages[1].model_name, "m1");
  assert.equal(conv.source_kind, "web_export");

  // Searchable straight away (FTS triggers)
  assert.equal((await t.api("GET", "/conversations?q=Second")).body.length, 1);
  delete IMPORTERS.other;
});

test("a parser crash marks the batch failed, original kept", async () => {
  const { IMPORTERS } = await import("../importers/index.js");
  IMPORTERS.gemini = async () => { throw new Error("not valid JSON"); };
  const r = await upload("garbage", { provider: "gemini" });
  assert.equal(r.body.status, "failed");
  assert.match(r.body.report.errors[0], /not valid JSON/);
  assert.ok(fs.existsSync(path.join(process.env.HUB_DATA_DIR, r.body.stored_path)));
  delete IMPORTERS.gemini;
});

test("history, info, reprocess stored batch", async () => {
  const list = (await t.api("GET", "/imports")).body;
  assert.ok(list.length >= 5);
  assert.equal(list[0].id > list[1].id, true); // newest first
  const info = (await t.api("GET", "/imports/info")).body;
  assert.equal(info.data_dir, process.env.HUB_DATA_DIR);

  const stored = list.find((b) => b.status === "stored");
  const { IMPORTERS } = await import("../importers/index.js");
  IMPORTERS.chatgpt = async () => ({ conversations: [], warnings: [] });
  const r = await t.api("POST", `/imports/${stored.id}/process`);
  assert.equal(r.body.status, "done");
  assert.equal((await t.api("POST", `/imports/${stored.id}/process`)).status, 409);
  delete IMPORTERS.chatgpt;
});
