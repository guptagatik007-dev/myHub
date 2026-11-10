import { Router } from "express";
import { db } from "../db/index.js";
import { requireText, optionalText, toId, now } from "./validate.js";

const router = Router();

// GET /api/notebooks -> list with counts
router.get("/", (req, res) => {
  res.json(db.prepare(`
    SELECT n.*,
      (SELECT COUNT(*) FROM knowledge_entries k WHERE k.notebook_id = n.id) AS entry_count,
      (SELECT COUNT(*) FROM conversation_notebooks cn WHERE cn.notebook_id = n.id) AS conversation_count
    FROM notebooks n ORDER BY n.updated_at DESC
  `).all());
});

// POST /api/notebooks
router.post("/", (req, res) => {
  const title = requireText(req.body.title, "title");
  const description = optionalText(req.body.description, "description");
  const instructions = optionalText(req.body.instructions, "instructions");
  const { lastInsertRowid } = db
    .prepare("INSERT INTO notebooks (title, description, instructions) VALUES (?, ?, ?)")
    .run(title, description, instructions);
  res.status(201).json(db.prepare("SELECT * FROM notebooks WHERE id = ?").get(lastInsertRowid));
});

// GET /api/notebooks/:id -> notebook + entries + linked conversations/projects
router.get("/:id", (req, res) => {
  const id = toId(req.params.id);
  const notebook = db.prepare("SELECT * FROM notebooks WHERE id = ?").get(id);
  if (!notebook) return res.status(404).json({ error: "Notebook not found" });

  notebook.entries = db
    .prepare("SELECT * FROM knowledge_entries WHERE notebook_id = ? ORDER BY created_at")
    .all(id);
  notebook.conversations = db.prepare(`
    SELECT c.id, c.title, c.provider, c.created_at FROM conversations c
    JOIN conversation_notebooks cn ON cn.conversation_id = c.id
    WHERE cn.notebook_id = ? ORDER BY c.created_at DESC`).all(id);
  notebook.projects = db.prepare(`
    SELECT p.id, p.title, p.status FROM projects p
    JOIN notebook_projects np ON np.project_id = p.id
    WHERE np.notebook_id = ? ORDER BY p.title`).all(id);
  res.json(notebook);
});

// PATCH /api/notebooks/:id -> update any of title/description/instructions
router.patch("/:id", (req, res) => {
  const id = toId(req.params.id);
  const existing = db.prepare("SELECT * FROM notebooks WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Notebook not found" });

  const b = req.body;
  const title = b.title !== undefined ? requireText(b.title, "title") : existing.title;
  const description = b.description !== undefined ? optionalText(b.description, "description") : existing.description;
  const instructions = b.instructions !== undefined ? optionalText(b.instructions, "instructions") : existing.instructions;

  db.prepare("UPDATE notebooks SET title = ?, description = ?, instructions = ?, updated_at = ? WHERE id = ?")
    .run(title, description, instructions, now(), id);
  res.json(db.prepare("SELECT * FROM notebooks WHERE id = ?").get(id));
});

// DELETE /api/notebooks/:id -> deletes notebook + its entries; conversations are kept
router.delete("/:id", (req, res) => {
  const { changes } = db.prepare("DELETE FROM notebooks WHERE id = ?").run(toId(req.params.id));
  if (!changes) return res.status(404).json({ error: "Notebook not found" });
  res.status(204).end();
});

export default router;
