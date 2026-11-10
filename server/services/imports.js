// Import pipeline: store original -> parse -> save conversations.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { db, DATA_DIR } from "../db/index.js";
import { IMPORTERS } from "../importers/index.js";

export const ORIGINALS_DIR = path.join(DATA_DIR, "imports", "original");
export const MAX_UPLOAD_BYTES = 2 * 1024 ** 3; // 2 GB
export const ALLOWED_EXTENSIONS = [".zip", ".json"];

// Keep only safe characters; never trust a filename from outside.
export function safeFilename(name) {
  const base = path.basename(String(name || "upload")).replace(/[^\w.\-]+/g, "_").replace(/^\.+/, "");
  return base.slice(-120) || "upload";
}

const now = () => new Date().toISOString();

/**
 * Stream an upload to disk, hashing as we go.
 * Returns the batch row. Throws { status, message } on problems.
 */
export async function storeUpload(stream, { filename, provider, accountLabel }) {
  const cleanName = safeFilename(filename);
  if (!ALLOWED_EXTENSIONS.includes(path.extname(cleanName).toLowerCase())) {
    throw httpError(400, `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`);
  }

  // 1. Write to a temp file inside the data dir (same disk -> atomic rename later).
  const tmpDir = path.join(DATA_DIR, "imports", "tmp");
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpPath = path.join(tmpDir, `${Date.now()}-${crypto.randomUUID()}`);

  const hash = crypto.createHash("sha256");
  let size = 0;
  const meter = new Transform({
    transform(chunk, _enc, cb) {
      size += chunk.length;
      if (size > MAX_UPLOAD_BYTES) return cb(httpError(413, "File too large (max 2 GB)"));
      hash.update(chunk);
      cb(null, chunk);
    },
  });

  try {
    await pipeline(stream, meter, fs.createWriteStream(tmpPath, { flags: "wx" }));
  } catch (err) {
    fs.rmSync(tmpPath, { force: true });
    throw err.status ? err : httpError(400, "Upload interrupted");
  }
  if (size === 0) {
    fs.rmSync(tmpPath, { force: true });
    throw httpError(400, "File is empty");
  }

  const checksum = hash.digest("hex");

  // 2. Same file already imported? Don't store it twice.
  const dup = db.prepare("SELECT id, imported_at FROM import_batches WHERE checksum = ?").get(checksum);
  if (dup) {
    fs.rmSync(tmpPath, { force: true });
    throw httpError(409, `This exact file was already imported (import #${dup.id}, ${dup.imported_at.slice(0, 10)}).`);
  }

  // 3. Create the batch, move the file into its permanent read-only home.
  const { lastInsertRowid: batchId } = db.prepare(`
    INSERT INTO import_batches (provider, original_filename, stored_path, checksum, status, account_label, size_bytes)
    VALUES (?, ?, '', ?, 'stored', ?, ?)`).run(provider, cleanName, checksum, accountLabel || null, size);

  const dir = path.join(ORIGINALS_DIR, provider, `${String(batchId).padStart(4, "0")}-${now().slice(0, 10)}`);
  fs.mkdirSync(dir, { recursive: true });
  const finalPath = path.join(dir, cleanName);
  fs.renameSync(tmpPath, finalPath);
  fs.chmodSync(finalPath, 0o444); // read-only: protects the original

  const relPath = path.relative(DATA_DIR, finalPath);
  db.prepare("UPDATE import_batches SET stored_path = ? WHERE id = ?").run(relPath, batchId);
  return getBatch(batchId);
}

/** Run the provider's parser on a stored batch and save results. */
export async function processBatch(batchId) {
  const batch = getBatch(batchId);
  if (!batch) throw httpError(404, "Import not found");
  if (batch.status === "done" || batch.status === "partial") throw httpError(409, "Already processed");

  const parse = IMPORTERS[batch.provider];
  if (!parse) {
    const report = { warnings: [`No ${batch.provider} importer yet. The original file is saved; process it again once the importer exists.`] };
    db.prepare("UPDATE import_batches SET report_json = ? WHERE id = ?").run(JSON.stringify(report), batchId);
    return getBatch(batchId);
  }

  let parsed;
  try {
    parsed = await parse(path.join(DATA_DIR, batch.stored_path));
  } catch (err) {
    const report = { errors: [`Could not read this file: ${err.message}`] };
    db.prepare("UPDATE import_batches SET status = 'failed', report_json = ?, processed_at = ? WHERE id = ?")
      .run(JSON.stringify(report), now(), batchId);
    return getBatch(batchId);
  }

  const report = saveConversations(batchId, batch.provider, batch.account_label, parsed);
  const status = report.failed > 0 || report.warnings.length > 0 ? "partial" : "done";
  db.prepare("UPDATE import_batches SET status = ?, report_json = ?, processed_at = ? WHERE id = ?")
    .run(status, JSON.stringify(report), now(), batchId);
  return getBatch(batchId);
}

/**
 * Save parsed conversations. One transaction per conversation, so one bad
 * conversation doesn't block the rest. Existing (provider, external_id) -> skipped.
 */
export function saveConversations(batchId, provider, accountLabel, { conversations = [], warnings = [] }) {
  const report = { total: conversations.length, imported: 0, skipped: 0, failed: 0, messages: 0, warnings: [...warnings], errors: [] };

  const exists = db.prepare("SELECT id FROM conversations WHERE provider = ? AND external_id = ?");
  const existsByHash = db.prepare("SELECT id FROM conversations WHERE provider = ? AND content_hash = ?");
  const insertConv = db.prepare(`
    INSERT INTO conversations (title, provider, source_kind, source_account_label, external_id,
      import_batch_id, content_hash, created_at, updated_at)
    VALUES (@title, @provider, 'web_export', @account, @external_id, @batch, @hash, @created_at, @updated_at)`);
  const insertMsg = db.prepare(`
    INSERT INTO messages (conversation_id, sequence_number, role, content, created_at, model_name, source_message_id, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

  const saveOne = db.transaction((c, hash) => {
    const { lastInsertRowid: convId } = insertConv.run({
      title: c.title?.trim() || "Untitled", provider, account: accountLabel || null,
      external_id: c.external_id || null, batch: batchId, hash,
      created_at: c.created_at || null, updated_at: c.updated_at || null,
    });
    c.messages.forEach((m, i) => {
      insertMsg.run(convId, i + 1, m.role || "other", m.content ?? "", m.created_at || null,
        m.model_name || null, m.source_message_id || null, m.metadata ? JSON.stringify(m.metadata) : null);
    });
  });

  for (const c of conversations) {
    try {
      const hash = contentHash(c);
      const dup = c.external_id ? exists.get(provider, c.external_id) : existsByHash.get(provider, hash);
      if (dup) { report.skipped++; continue; }
      saveOne(c, hash);
      report.imported++;
      report.messages += c.messages.length;
    } catch (err) {
      report.failed++;
      report.errors.push(`"${c.title || c.external_id || "untitled"}": ${err.message}`);
    }
  }
  return report;
}

// Fingerprint of a conversation's content (used when there's no external ID).
export function contentHash(c) {
  const h = crypto.createHash("sha256");
  h.update(c.title || "");
  for (const m of c.messages || []) h.update(`\u0000${m.role}\u0000${m.content}`);
  return h.digest("hex");
}

export function getBatch(id) {
  const b = db.prepare("SELECT * FROM import_batches WHERE id = ?").get(id);
  if (!b) return null;
  b.report = b.report_json ? JSON.parse(b.report_json) : null;
  delete b.report_json;
  b.has_importer = Boolean(IMPORTERS[b.provider]);
  return b;
}

export function listBatches() {
  return db.prepare("SELECT id FROM import_batches ORDER BY id DESC").all().map((r) => getBatch(r.id));
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
