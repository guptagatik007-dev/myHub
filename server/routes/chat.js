// Chatting with a local model inside MyHub.
//   GET  /api/models                -> models you can pick from
//   GET  /api/local-model           -> status
//   POST /api/local-model/start     -> start (waits until ready)
//   POST /api/local-model/stop
//   POST /api/chats                 { notebook_id?, project_id? } -> new empty hub conversation (optionally linked)
//   POST /api/chats/:id/messages    { content, model? } -> saves your message, asks the model, saves the reply
import { Router } from "express";
import { db } from "../db/index.js";
import * as localModel from "../services/localModel.js";
import { listModels, findModel, defaultModel } from "../services/models.js";
import { requireText, toId, now, badRequest } from "./validate.js";

const router = Router();

router.get("/models", (req, res) => res.json({ models: listModels(), default: defaultModel() }));
router.get("/local-model", (req, res) => res.json(localModel.getStatus()));
router.post("/local-model/start", async (req, res) => res.json(await localModel.start()));
router.post("/local-model/stop", (req, res) => res.json(localModel.stop()));

router.post("/chats", (req, res) => {
  const notebookId = req.body?.notebook_id != null ? toId(req.body.notebook_id) : null;
  const projectId = req.body?.project_id != null ? toId(req.body.project_id) : null;
  if (req.body?.notebook_id != null && !db.prepare("SELECT 1 FROM notebooks WHERE id = ?").get(notebookId)) throw badRequest("Notebook not found");
  if (req.body?.project_id != null && !db.prepare("SELECT 1 FROM projects WHERE id = ?").get(projectId)) throw badRequest("Project not found");

  const ts = now();
  const id = db.transaction(() => {
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO conversations (title, provider, source_kind, created_at, updated_at)
      VALUES ('New chat', 'hub', 'hub', ?, ?)`).run(ts, ts);
    if (notebookId) db.prepare("INSERT INTO conversation_notebooks VALUES (?, ?)").run(lastInsertRowid, notebookId);
    if (projectId) db.prepare("INSERT INTO conversation_projects VALUES (?, ?)").run(lastInsertRowid, projectId);
    return lastInsertRowid;
  })();
  res.status(201).json({ id });
});

// One reply at a time per conversation.
const busy = new Set();

router.post("/chats/:id/messages", async (req, res) => {
  const id = toId(req.params.id);
  const conv = db.prepare("SELECT * FROM conversations WHERE id = ?").get(id);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  if (conv.provider !== "hub") return res.status(400).json({ error: "Only MyHub chats can be continued (imported conversations are read-only)." });
  if (busy.has(id)) return res.status(409).json({ error: "Still waiting for the previous reply." });

  const content = requireText(req.body?.content, "content", 50000);
  const modelId = req.body?.model || defaultModel();
  const model = findModel(modelId);
  if (!model) throw badRequest(`Unknown model: ${modelId}`);
  if (!model.available) throw badRequest(`${model.label} isn't available yet.`);
  busy.add(id);
  try {
    // 1. Save your message first, so it's never lost even if the model fails.
    const nextSeq = () => db.prepare("SELECT COALESCE(MAX(sequence_number), 0) + 1 AS n FROM messages WHERE conversation_id = ?").get(id).n;
    const userMsg = db.prepare(`
      INSERT INTO messages (conversation_id, sequence_number, role, content, created_at)
      VALUES (?, ?, 'user', ?, ?) RETURNING *`).get(id, nextSeq(), content, now());

    // First message becomes the title.
    if (conv.title === "New chat") {
      const title = content.replace(/\s+/g, " ").trim().slice(0, 60) + (content.length > 60 ? "…" : "");
      db.prepare("UPDATE conversations SET title = ? WHERE id = ?").run(title, id);
    }

    // 2. Send the whole thread (user + assistant turns) to the model.
    const history = db.prepare(`
      SELECT role, content FROM messages
      WHERE conversation_id = ? AND role IN ('user', 'assistant', 'system')
      ORDER BY sequence_number`).all(id);

    let reply;
    try {
      reply = await localModel.chat(history, model.id);
    } catch (err) {
      return res.status(err.status || 502).json({ error: err.message, userMessage: userMsg });
    }

    // 3. Save the reply with which model wrote it.
    const metadata = { reasoning: reply.reasoning || undefined, usage: reply.usage || undefined, finish_reason: reply.finish_reason };
    const assistantMsg = db.prepare(`
      INSERT INTO messages (conversation_id, sequence_number, role, content, created_at, model_name, metadata_json)
      VALUES (?, ?, 'assistant', ?, ?, ?, ?) RETURNING *`)
      .get(id, nextSeq(), reply.content, now(), reply.model, JSON.stringify(metadata));
    db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(now(), id);

    res.json({ userMessage: userMsg, assistantMessage: assistantMsg });
  } finally {
    busy.delete(id);
  }
});

export default router;
