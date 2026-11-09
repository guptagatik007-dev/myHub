// Inserts a little demo data. Run: npm run seed
import { db } from "../db/index.js";

const seed = db.transaction(() => {
  const conv = db.prepare(
    `INSERT INTO conversations (title, provider, source_kind, created_at)
     VALUES (?, ?, 'manual', ?)`
  );
  const msg = db.prepare(
    `INSERT INTO messages (conversation_id, sequence_number, role, content, model_name)
     VALUES (?, ?, ?, ?, ?)`
  );

  const c1 = conv.run("Choosing a database for MyHub", "claude", "2026-11-01T10:00:00Z").lastInsertRowid;
  msg.run(c1, 1, "user", "Should I use SQLite or MongoDB for a local app?", null);
  msg.run(c1, 2, "assistant", "SQLite: single file, no server, relational links.", "claude-demo");

  const c2 = conv.run("Learning React hooks", "chatgpt", "2026-10-20T09:00:00Z").lastInsertRowid;
  msg.run(c2, 1, "user", "Explain useEffect briefly.", null);
  msg.run(c2, 2, "assistant", "It runs side effects after render.", "gpt-demo");

  const nb1 = db.prepare("INSERT INTO notebooks (title, description) VALUES (?, ?)")
    .run("AI research", "Things I'm learning about AI tools").lastInsertRowid;
  const nb2 = db.prepare("INSERT INTO notebooks (title, description) VALUES (?, ?)")
    .run("Learning notes", "General learning").lastInsertRowid;
  const p1 = db.prepare("INSERT INTO projects (title, description) VALUES (?, ?)")
    .run("MyHub V0", "Personal context hub").lastInsertRowid;

  // Same conversation linked to TWO notebooks + one project — stored once.
  db.prepare("INSERT INTO conversation_notebooks VALUES (?, ?)").run(c1, nb1);
  db.prepare("INSERT INTO conversation_notebooks VALUES (?, ?)").run(c1, nb2);
  db.prepare("INSERT INTO conversation_projects VALUES (?, ?)").run(c1, p1);
  db.prepare("INSERT INTO notebook_projects VALUES (?, ?)").run(nb1, p1);

  const ke = db.prepare(
    "INSERT INTO knowledge_entries (type, content, project_id) VALUES (?, ?, ?)"
  );
  ke.run("objective", "Build a local-first context hub.", p1);
  const d = ke.run("decision", "Use SQLite via better-sqlite3.", p1).lastInsertRowid;
  ke.run("pending", "Get real export samples.", p1);
  db.prepare("INSERT INTO knowledge_sources (knowledge_entry_id, conversation_id) VALUES (?, ?)").run(d, c1);
});

if (db.prepare("SELECT COUNT(*) AS n FROM conversations").get().n > 0) {
  console.log("Database already has data — skipping seed.");
} else {
  seed();
  console.log("Seeded demo data.");
}
