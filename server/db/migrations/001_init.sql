-- Core V0 schema. Dates are ISO-8601 text (e.g. 2026-11-10T12:00:00.000Z).
-- IDs are integers auto-assigned by SQLite.

CREATE TABLE import_batches (
  id               INTEGER PRIMARY KEY,
  provider         TEXT NOT NULL,             -- chatgpt | claude | gemini | other
  original_filename TEXT NOT NULL,
  stored_path      TEXT NOT NULL,             -- preserved original, under DATA_DIR
  checksum         TEXT,                      -- sha256 of the original file
  status           TEXT NOT NULL DEFAULT 'pending', -- pending | done | failed
  report_json      TEXT,                      -- counts, warnings, errors
  imported_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE conversations (
  id                   INTEGER PRIMARY KEY,
  title                TEXT NOT NULL DEFAULT 'Untitled',
  provider             TEXT NOT NULL,         -- chatgpt | claude | gemini | other | hub
  source_kind          TEXT NOT NULL DEFAULT 'manual', -- web_export | mobile_export | manual | hub
  source_account_label TEXT,
  external_id          TEXT,                  -- provider's own conversation ID
  import_batch_id      INTEGER REFERENCES import_batches(id) ON DELETE SET NULL,
  content_hash         TEXT,
  created_at           TEXT,
  updated_at           TEXT,
  UNIQUE (provider, external_id)              -- blocks duplicate imports
);

CREATE TABLE messages (
  id                INTEGER PRIMARY KEY,
  conversation_id   INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sequence_number   INTEGER NOT NULL,
  role              TEXT NOT NULL,            -- user | assistant | system | tool | other
  content           TEXT NOT NULL DEFAULT '',
  created_at        TEXT,
  model_name        TEXT,
  source_message_id TEXT,
  metadata_json     TEXT,
  UNIQUE (conversation_id, sequence_number)
);

CREATE TABLE notebooks (
  id           INTEGER PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  instructions TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE projects (
  id          INTEGER PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'active', -- active | paused | done
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Notes, decisions, progress, pending items, etc. Global if both IDs are NULL.
CREATE TABLE knowledge_entries (
  id          INTEGER PRIMARY KEY,
  type        TEXT NOT NULL CHECK (type IN ('objective','decision','progress','pending','idea','note','link')),
  title       TEXT,
  content     TEXT NOT NULL DEFAULT '',
  status      TEXT,                           -- e.g. open | done (for pending items)
  project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  notebook_id INTEGER REFERENCES notebooks(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Many-to-many links. A conversation is stored once and linked many times.
CREATE TABLE conversation_notebooks (
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  notebook_id     INTEGER NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, notebook_id)
);

CREATE TABLE conversation_projects (
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, project_id)
);

CREATE TABLE notebook_projects (
  notebook_id INTEGER NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  PRIMARY KEY (notebook_id, project_id)
);

-- Where a knowledge entry came from (a conversation, optionally a specific message).
CREATE TABLE knowledge_sources (
  id                 INTEGER PRIMARY KEY,
  knowledge_entry_id INTEGER NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  conversation_id    INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
  message_id         INTEGER REFERENCES messages(id) ON DELETE SET NULL
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, sequence_number);
CREATE INDEX idx_conversations_provider ON conversations(provider, created_at);
CREATE INDEX idx_knowledge_project ON knowledge_entries(project_id);
CREATE INDEX idx_knowledge_notebook ON knowledge_entries(notebook_id);
