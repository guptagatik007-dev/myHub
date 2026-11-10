// GET /api/export/:kind/:id            -> Markdown text
//     ?transcripts=1                   -> include full linked conversations (notebook/project)
//     ?download=1                      -> send as a .md file download
import { Router } from "express";
import { conversationMarkdown, notebookMarkdown, projectMarkdown, slugify } from "../services/markdown.js";
import { toId } from "./validate.js";

const router = Router();
const EXPORTERS = { conversation: conversationMarkdown, notebook: notebookMarkdown, project: projectMarkdown };

router.get("/:kind/:id", (req, res) => {
  const exporter = EXPORTERS[req.params.kind];
  if (!exporter) return res.status(404).json({ error: "Unknown export type" });

  const result = exporter(toId(req.params.id), { includeTranscripts: req.query.transcripts === "1" });
  if (!result) return res.status(404).json({ error: "Not found" });

  res.type("text/markdown; charset=utf-8");
  if (req.query.download === "1") {
    res.attachment(`${req.params.kind}-${slugify(result.title)}.md`);
  }
  res.send(result.markdown);
});

export default router;
