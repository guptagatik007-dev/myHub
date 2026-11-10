-- More detail on imports.
-- status: stored (original saved, not parsed yet) | done | partial (some warnings/failures) | failed
ALTER TABLE import_batches ADD COLUMN account_label TEXT;
ALTER TABLE import_batches ADD COLUMN size_bytes INTEGER;
ALTER TABLE import_batches ADD COLUMN processed_at TEXT;
CREATE INDEX idx_import_batches_checksum ON import_batches(checksum);
