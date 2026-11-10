// Knowledge entries: objective, decision, progress, pending, idea, note, link.
import { Router } from "express";
import { db } from "../db/index.js";
import { requireText, optionalText, oneOf, toId, badRequest, now } from "./validate.js";

const router = Router();
export const ENTRY_TYPES = ["objective", "decision", "progress", "pending", "idea", "note", "link"];
const ENTRY_STATUSES = ["open", "done"];

function checkParent(table, id) {
  if (id === null || id === undefined) return null;
  const parsed = toId(id);
  if (!parsed || !db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(parsed)) {
    throw badRequest(`${table.slice(0, -1)} ${id} does not exist`);
  }
  return parsed;
}

// POST /api/entries  { type, content, title?, status?, project_id?, notebook_id? }
router.post("/", (req, res) => {
  const b = req.body;
  const type = oneOf(b.type, "type", ENTRY_TYPES);
  const content = requireText(b.content, "content", 20000);
  const title = optionalText(b.title, "title", 500);
  const project_id = checkParent("projects", b.project_id);
  const notebook_id = checkParent("notebooks", b.notebook_id);
  const status = b.status ? oneOf(b.status, "status", ENTRY_STATUSES) : type === "pending" ? "open" : null;

  // Global entries (no project, no notebook) aren't used yet — require a home.
  if (!project_id && !notebook_id) throw badRequest("project_id or notebook_id is required");

  const { lastInsertRowid } = db.prepare(`
    INSERT INTO knowledge_entries (type, title, content, status, project_id, notebook_id)
    VALUES (?, ?, ?, ?, ?, ?)`).run(type, title, content, status, project_id, notebook_id);
  res.status(201).json(db.prepare("SELECT * FROM knowledge_entries WHERE id = ?").get(lastInsertRowid));
});

// PATCH /api/entries/:id  { content?, title?, status?, type? }
router.patch("/:id", (req, res) => {
  const id = toId(req.params.id);
  const e = db.prepare("SELECT * FROM knowledge_entries WHERE id = ?").get(id);
  if (!e) return res.status(404).json({ error: "Entry not found" });

  const b = req.body;
  const type = b.type !== undefined ? oneOf(b.type, "type", ENTRY_TYPES) : e.type;
  const content = b.content !== undefined ? requireText(b.content, "content", 20000) : e.content;
  const title = b.title !== undefined ? optionalText(b.title, "title", 500) : e.title;
  const status = b.status !== undefined ? (b.status === null ? null : oneOf(b.status, "status", ENTRY_STATUSES)) : e.status;

  db.prepare("UPDATE knowledge_entries SET type = ?, content = ?, title = ?, status = ?, updated_at = ? WHERE id = ?")
    .run(type, content, title, status, now(), id);
  res.json(db.prepare("SELECT * FROM knowledge_entries WHERE id = ?").get(id));
});

// DELETE /api/entries/:id
router.delete("/:id", (req, res) => {
  const { changes } = db.prepare("DELETE FROM knowledge_entries WHERE id = ?").run(toId(req.params.id));
  if (!changes) return res.status(404).json({ error: "Entry not found" });
  res.status(204).end();
});

export default router;
