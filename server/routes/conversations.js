import { Router } from "express";
import { db } from "../db/index.js";

const router = Router();

// Turn user text into a safe FTS5 query: each word quoted, prefix-matched.
// e.g. `react hooks` -> `"react"* "hooks"*`
function toFtsQuery(text) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `"${word.replace(/"/g, '""')}"*`)
    .join(" ");
}

// GET /api/conversations?q=...&provider=...&limit=...  (most recently active first)
router.get("/", (req, res) => {
  const { q = "", provider = "" } = req.query;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 500, 1), 500);
  const where = [];
  const params = {};

  if (provider) {
    where.push("c.provider = @provider");
    params.provider = provider;
  }
  if (q.trim()) {
    // Match on title OR any message in the conversation.
    where.push(`(c.title LIKE @like OR c.id IN (
      SELECT m.conversation_id FROM messages_fts
      JOIN messages m ON m.id = messages_fts.rowid
      WHERE messages_fts MATCH @fts))`);
    params.like = `%${q.trim()}%`;
    params.fts = toFtsQuery(q);
  }

  const rows = db.prepare(`
    SELECT c.id, c.title, c.provider, c.created_at, c.updated_at,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
    FROM conversations c
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY COALESCE(c.updated_at, c.created_at) DESC, c.id DESC
    LIMIT @limit
  `).all({ ...params, limit });

  res.json(rows);
});

// GET /api/conversations/:id -> conversation + ordered messages + links
router.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  const conversation = db.prepare("SELECT * FROM conversations WHERE id = ?").get(id);
  if (!conversation) return res.status(404).json({ error: "Conversation not found" });

  conversation.messages = db
    .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY sequence_number")
    .all(id);
  conversation.notebooks = db.prepare(`
    SELECT n.id, n.title FROM notebooks n
    JOIN conversation_notebooks cn ON cn.notebook_id = n.id
    WHERE cn.conversation_id = ?`).all(id);
  conversation.projects = db.prepare(`
    SELECT p.id, p.title FROM projects p
    JOIN conversation_projects cp ON cp.project_id = p.id
    WHERE cp.conversation_id = ?`).all(id);

  res.json(conversation);
});

export default router;
