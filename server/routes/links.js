// Many-to-many links. PUT = link (idempotent), DELETE = unlink.
//   /api/links/conversation/:conversationId/notebook/:notebookId
//   /api/links/conversation/:conversationId/project/:projectId
//   /api/links/notebook/:notebookId/project/:projectId
import { Router } from "express";
import { db } from "../db/index.js";
import { toId } from "./validate.js";

const router = Router();

// [left type, right type] -> join table + columns. Fixed list = no SQL injection.
const LINKS = {
  "conversation:notebook": ["conversation_notebooks", "conversation_id", "notebook_id", "conversations", "notebooks"],
  "conversation:project":  ["conversation_projects",  "conversation_id", "project_id",  "conversations", "projects"],
  "notebook:project":      ["notebook_projects",      "notebook_id",     "project_id",  "notebooks",     "projects"],
};

function resolve(req, res) {
  const { aType, aId, bType, bId } = req.params;
  const spec = LINKS[`${aType}:${bType}`];
  if (!spec) { res.status(404).json({ error: "Unknown link type" }); return null; }
  const [table, aCol, bCol, aTable, bTable] = spec;
  const a = toId(aId), b = toId(bId);
  if (!db.prepare(`SELECT 1 FROM ${aTable} WHERE id = ?`).get(a) ||
      !db.prepare(`SELECT 1 FROM ${bTable} WHERE id = ?`).get(b)) {
    res.status(404).json({ error: "Item not found" }); return null;
  }
  return { table, aCol, bCol, a, b };
}

router.put("/:aType/:aId/:bType/:bId", (req, res) => {
  const r = resolve(req, res); if (!r) return;
  db.prepare(`INSERT OR IGNORE INTO ${r.table} (${r.aCol}, ${r.bCol}) VALUES (?, ?)`).run(r.a, r.b);
  res.status(204).end();
});

router.delete("/:aType/:aId/:bType/:bId", (req, res) => {
  const r = resolve(req, res); if (!r) return;
  db.prepare(`DELETE FROM ${r.table} WHERE ${r.aCol} = ? AND ${r.bCol} = ?`).run(r.a, r.b);
  res.status(204).end();
});

export default router;
