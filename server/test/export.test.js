import { test } from "node:test";
import assert from "node:assert/strict";
import { setupTestServer } from "./helpers.js";

const t = setupTestServer(); // seeded: project 1 "MyHub V0", notebooks 1-2, conversations 1-2

const md = async (p) => {
  const res = await fetch(t.base + p);
  return { status: res.status, type: res.headers.get("content-type"), disp: res.headers.get("content-disposition"), text: await res.text() };
};

test("conversation export: title, source, ordered messages", async () => {
  const r = await md("/export/conversation/1");
  assert.equal(r.status, 200);
  assert.match(r.type, /text\/markdown/);
  assert.match(r.text, /^# Choosing a database for MyHub/);
  assert.match(r.text, /\*\*Source:\*\* Claude/);
  assert.ok(r.text.indexOf("## User") < r.text.indexOf("## Assistant (claude-demo)"));
});

test("project export: structured sections + related items", async () => {
  await t.api("POST", "/entries", { type: "pending", content: "Done thing", project_id: 1, status: "done" });
  const r = await md("/export/project/1");
  for (const s of ["# Project: MyHub V0", "## Objective", "## Decisions", "## Open items / next actions",
                   "- [ ] Get real export samples.", "- [x] Done thing", "## Related notebooks", "## Related conversations"]) {
    assert.ok(r.text.includes(s), `missing: ${s}`);
  }
  assert.ok(!r.text.includes("## Conversation transcripts"));
});

test("transcripts option includes full linked conversations", async () => {
  const r = await md("/export/project/1?transcripts=1");
  assert.ok(r.text.includes("## Conversation transcripts"));
  assert.ok(r.text.includes("SQLite: single file"));
});

test("notebook export + multi-line entries stay inside bullets", async () => {
  await t.api("POST", "/entries", { type: "note", content: "line one\nline two", notebook_id: 1 });
  await t.api("POST", "/entries", { type: "link", content: "https://example.com", title: "Example", notebook_id: 1 });
  const r = await md("/export/notebook/1");
  assert.match(r.text, /^# Notebook: AI research/);
  assert.ok(r.text.includes("- line one\n  line two"));
  assert.ok(r.text.includes("- [Example](https://example.com)"));
});

test("download sets a safe filename; unknowns 404", async () => {
  const r = await md("/export/project/1?download=1");
  assert.match(r.disp, /attachment; filename="?project-myhub-v0\.md"?/);
  assert.equal((await md("/export/project/999")).status, 404);
  assert.equal((await md("/export/widget/1")).status, 404);
});
