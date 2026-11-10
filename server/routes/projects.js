import { Router } from "express";
import { db } from "../db/index.js";
import { requireText, optionalText, oneOf, toId, now } from "./validate.js";

const router = Router();
export const PROJECT_STATUSES = ["active", "paused", "done"];

// GET /api/projects -> list with counts
router.get("/", (req, res) => {
  res.json(db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM knowledge_entries k WHERE k.project_id = p.id AND k.type = 'pending' AND COALESCE(k.status, 'open') = 'open') AS open_pending,
      (SELECT COUNT(*) FROM conversation_projects cp WHERE cp.project_id = p.id) AS conversation_count
    FROM projects p ORDER BY p.updated_at DESC
  `).all());
});

// POST /api/projects
router.post("/", (req, res) => {
  const title = requireText(req.body.title, "title");
  const description = optionalText(req.body.description, "description");
  const status = req.body.status ? oneOf(req.body.status, "status", PROJECT_STATUSES) : "active";
  const { lastInsertRowid } = db
    .prepare("INSERT INTO projects (title, description, status) VALUES (?, ?, ?)")
    .run(title, description, status);
  res.status(201).json(db.prepare("SELECT * FROM projects WHERE id = ?").get(lastInsertRowid));
});

// GET /api/projects/:id -> project + entries + linked conversations/notebooks
router.get("/:id", (req, res) => {
  const id = toId(req.params.id);
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  if (!project) return res.status(404).json({ error: "Project not found" });

  project.entries = db
    .prepare("SELECT * FROM knowledge_entries WHERE project_id = ? ORDER BY created_at")
    .all(id);
  project.conversations = db.prepare(`
    SELECT c.id, c.title, c.provider, c.created_at, c.updated_at,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
    FROM conversations c
    JOIN conversation_projects cp ON cp.conversation_id = c.id
    WHERE cp.project_id = ? ORDER BY COALESCE(c.updated_at, c.created_at) DESC`).all(id);
  project.notebooks = db.prepare(`
    SELECT n.id, n.title FROM notebooks n
    JOIN notebook_projects np ON np.notebook_id = n.id
    WHERE np.project_id = ? ORDER BY n.title`).all(id);
  res.json(project);
});

// PATCH /api/projects/:id
router.patch("/:id", (req, res) => {
  const id = toId(req.params.id);
  const existing = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Project not found" });

  const b = req.body;
  const title = b.title !== undefined ? requireText(b.title, "title") : existing.title;
  const description = b.description !== undefined ? optionalText(b.description, "description") : existing.description;
  const status = b.status !== undefined ? oneOf(b.status, "status", PROJECT_STATUSES) : existing.status;

  db.prepare("UPDATE projects SET title = ?, description = ?, status = ?, updated_at = ? WHERE id = ?")
    .run(title, description, status, now(), id);
  res.json(db.prepare("SELECT * FROM projects WHERE id = ?").get(id));
});

// DELETE /api/projects/:id -> deletes project + its entries; conversations are kept
router.delete("/:id", (req, res) => {
  const { changes } = db.prepare("DELETE FROM projects WHERE id = ?").run(toId(req.params.id));
  if (!changes) return res.status(404).json({ error: "Project not found" });
  res.status(204).end();
});

export default router;
