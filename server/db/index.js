// Opens the SQLite database and applies any pending migrations.
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// All user data lives outside the repo. Override with HUB_DATA_DIR (useful for testing).
export const DATA_DIR =
  process.env.HUB_DATA_DIR ||
  path.join(os.homedir(), "Library", "Application Support", "PersonalContextHub");

const DB_PATH = path.join(DATA_DIR, "database", "context-hub.sqlite");
const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL"); // better crash safety + concurrent reads
db.pragma("foreign_keys = ON");  // SQLite has FKs OFF by default!

// Migrations: files named 001_xxx.sql, 002_xxx.sql...
// SQLite's built-in `user_version` number remembers the last one applied.
function migrate() {
  const current = db.pragma("user_version", { simple: true });
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    const version = parseInt(file, 10);
    if (version <= current) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    db.transaction(() => {
      db.exec(sql);
      db.pragma(`user_version = ${version}`);
    })();
    console.log(`Applied migration ${file}`);
  }
}

migrate();
console.log(`Database: ${DB_PATH}`);
