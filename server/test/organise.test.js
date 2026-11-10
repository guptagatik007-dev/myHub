// Notebooks, projects, entries, links.
import { test } from "node:test";
import assert from "node:assert/strict";
import { setupTestServer } from "./helpers.js";

const t = setupTestServer({ seed: false });

test("create, read, update, delete a notebook", async () => {
  const created = await t.api("POST", "/notebooks", { title: "  Ideas  ", description: "misc" });
  assert.equal(created.status, 201);
  assert.equal(created.body.title, "Ideas"); // trimmed

  const updated = await t.api("PATCH", `/notebooks/${created.body.id}`, { instructions: "Be brief" });
  assert.equal(updated.body.instructions, "Be brief");
  assert.equal(updated.body.description, "misc"); // untouched fields kept

  assert.equal((await t.api("DELETE", `/notebooks/${created.body.id}`)).status, 204);
  assert.equal((await t.api("GET", `/notebooks/${created.body.id}`)).status, 404);
});

test("validation errors return 400 with a message", async () => {
  const r1 = await t.api("POST", "/projects", { title: "" });
  assert.equal(r1.status, 400);
  assert.match(r1.body.error, /title/);
  assert.equal((await t.api("POST", "/projects", { title: "X", status: "weird" })).status, 400);
  assert.equal((await t.api("POST", "/entries", { type: "note", content: "orphan" })).status, 400);
  assert.equal((await t.api("POST", "/entries", { type: "bogus", content: "x", project_id: 1 })).status, 400);
  assert.equal((await t.api("POST", "/entries", { type: "note", content: "x", project_id: 999 })).status, 400);
});

test("project entries: pending defaults to open, can be marked done", async () => {
  const p = (await t.api("POST", "/projects", { title: "MyHub" })).body;
  assert.equal(p.status, "active");

  const pending = (await t.api("POST", "/entries", { type: "pending", content: "Get exports", project_id: p.id })).body;
  assert.equal(pending.status, "open");
  await t.api("POST", "/entries", { type: "decision", content: "Use SQLite", project_id: p.id });

  assert.equal((await t.api("GET", "/projects")).body.find((x) => x.id === p.id).open_pending, 1);
  await t.api("PATCH", `/entries/${pending.id}`, { status: "done" });
  assert.equal((await t.api("GET", "/projects")).body.find((x) => x.id === p.id).open_pending, 0);

  const detail = (await t.api("GET", `/projects/${p.id}`)).body;
  assert.equal(detail.entries.length, 2);
});

test("links: idempotent, many-to-many, unlink, cascade keeps conversation", async () => {
  // A conversation to link (inserted via a notebook-free path: direct DB through seed-like insert)
  const { db } = await import("../db/index.js");
  const convId = db.prepare("INSERT INTO conversations (title, provider) VALUES ('Chat', 'claude')").run().lastInsertRowid;

  const nb1 = (await t.api("POST", "/notebooks", { title: "A" })).body.id;
  const nb2 = (await t.api("POST", "/notebooks", { title: "B" })).body.id;
  const pr = (await t.api("POST", "/projects", { title: "P" })).body.id;

  assert.equal((await t.api("PUT", `/links/conversation/${convId}/notebook/${nb1}`)).status, 204);
  assert.equal((await t.api("PUT", `/links/conversation/${convId}/notebook/${nb1}`)).status, 204); // again: no dup
  await t.api("PUT", `/links/conversation/${convId}/notebook/${nb2}`);
  await t.api("PUT", `/links/conversation/${convId}/project/${pr}`);
  await t.api("PUT", `/links/notebook/${nb1}/project/${pr}`);

  let conv = (await t.api("GET", `/conversations/${convId}`)).body;
  assert.equal(conv.notebooks.length, 2);
  assert.equal(conv.projects.length, 1);
  assert.equal((await t.api("GET", `/projects/${pr}`)).body.notebooks[0].title, "A");

  await t.api("DELETE", `/links/conversation/${convId}/notebook/${nb2}`);
  await t.api("DELETE", `/notebooks/${nb1}`);
  conv = (await t.api("GET", `/conversations/${convId}`)).body;
  assert.equal(conv.notebooks.length, 0);   // links gone
  assert.equal(conv.title, "Chat");         // conversation kept

  assert.equal((await t.api("PUT", `/links/conversation/${convId}/notebook/9999`)).status, 404);
  assert.equal((await t.api("PUT", `/links/project/1/conversation/1`)).status, 404); // unknown direction
});

test("malformed JSON body -> 400", async () => {
  const res = await fetch(t.base + "/notebooks", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{bad",
  });
  assert.equal(res.status, 400);
});
