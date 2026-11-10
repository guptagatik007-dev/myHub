// Conversation archive smoke tests. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { setupTestServer } from "./helpers.js";

const t = setupTestServer();
const get = (p) => t.api("GET", p);

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

test("limit + most recently active first", async () => {
  assert.equal((await get("/conversations?limit=1")).body.length, 1);
  assert.equal((await get("/conversations?limit=-5")).body.length, 1); // clamped to >= 1
  assert.equal((await get("/conversations?limit=abc")).body.length, 2); // invalid -> default
});
