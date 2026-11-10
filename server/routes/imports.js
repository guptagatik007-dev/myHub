// POST /api/imports?provider=chatgpt&filename=x.zip&label=Work   (body = raw file bytes)
// GET  /api/imports              -> history
// GET  /api/imports/info         -> where data lives
// GET  /api/imports/:id
// POST /api/imports/:id/process  -> run the parser on a stored original
import { Router } from "express";
import path from "node:path";
import { DATA_DIR } from "../db/index.js";
import { PROVIDERS } from "../importers/index.js";
import { storeUpload, processBatch, getBatch, listBatches, ORIGINALS_DIR, MAX_UPLOAD_BYTES } from "../services/imports.js";
import { oneOf, optionalText, toId } from "./validate.js";

const router = Router();

router.get("/", (req, res) => res.json(listBatches()));

router.get("/info", (req, res) => {
  res.json({
    data_dir: DATA_DIR,
    database: path.join(DATA_DIR, "database", "context-hub.sqlite"),
    originals_dir: ORIGINALS_DIR,
    max_upload_bytes: MAX_UPLOAD_BYTES,
    providers: PROVIDERS,
  });
});

router.get("/:id", (req, res) => {
  const batch = getBatch(toId(req.params.id));
  if (!batch) return res.status(404).json({ error: "Import not found" });
  res.json(batch);
});

router.post("/", async (req, res) => {
  const provider = oneOf(req.query.provider, "provider", PROVIDERS);
  const accountLabel = optionalText(req.query.label, "label", 100);
  const batch = await storeUpload(req, { filename: req.query.filename, provider, accountLabel });
  // Parse right away if we can; otherwise it stays "stored".
  res.status(201).json(await processBatch(batch.id));
});

router.post("/:id/process", async (req, res) => {
  res.json(await processBatch(toId(req.params.id)));
});

export default router;
