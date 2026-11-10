// Turns hub data into portable, readable Markdown for pasting into any AI tool.
import { db } from "../db/index.js";

const PROVIDER_NAMES = { chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini", hub: "MyHub", other: "Other" };
const providerName = (p) => PROVIDER_NAMES[p] || p;
const oneLine = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const date = (iso) => (iso ? iso.slice(0, 10) : "unknown date");
const exportedAt = () => `_Exported from MyHub on ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC._`;

// ---------- Conversation ----------

function loadConversation(id) {
  const c = db.prepare("SELECT * FROM conversations WHERE id = ?").get(id);
  if (!c) return null;
  c.messages = db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY sequence_number").all(id);
  return c;
}

function conversationBody(c, headingLevel = 1) {
  const h = "#".repeat(headingLevel);
  const lines = [
    `${h} ${oneLine(c.title)}`,
    "",
    `- **Source:** ${providerName(c.provider)}${c.source_account_label ? ` (${oneLine(c.source_account_label)})` : ""}`,
    `- **Date:** ${date(c.created_at)}`,
    `- **Messages:** ${c.messages.length}`,
    `- **Hub reference:** conversation #${c.id}`,
    "",
  ];
  for (const m of c.messages) {
    const who = m.role === "assistant" ? `Assistant${m.model_name ? ` (${m.model_name})` : ""}` : m.role[0].toUpperCase() + m.role.slice(1);
    lines.push(`${h}# ${who}`, "", m.content.trim() || "_(empty message)_", "");
  }
  return lines.join("\n");
}

export function conversationMarkdown(id) {
  const c = loadConversation(id);
  if (!c) return null;
  return { title: c.title, markdown: `${conversationBody(c)}\n---\n${exportedAt()}\n` };
}

// ---------- Shared pieces for notebooks & projects ----------

function entryList(entries, { checkbox = false } = {}) {
  return entries
    .map((e) => {
      const box = checkbox ? (e.status === "done" ? "[x] " : "[ ] ") : "";
      const text = e.type === "link" ? (e.title ? `[${oneLine(e.title)}](${e.content.trim()})` : e.content.trim()) : e.content.trim();
      // Indent continuation lines so multi-line entries stay inside their bullet.
      return `- ${box}${text.replace(/\n/g, "\n  ")}`;
    })
    .join("\n");
}

function section(title, body) {
  return body && body.trim() ? `## ${title}\n\n${body.trim()}\n` : "";
}

function linkedConversationsSection(convs, includeTranscripts) {
  if (!convs.length) return "";
  const list = convs
    .map((c) => `- ${oneLine(c.title)} — ${providerName(c.provider)}, ${date(c.created_at)} (conversation #${c.id})`)
    .join("\n");
  let out = section("Related conversations", list);
  if (includeTranscripts) {
    out += "\n## Conversation transcripts\n\n";
    out += convs.map((c) => conversationBody(loadConversation(c.id), 3)).join("\n---\n\n");
  }
  return out;
}

const byType = (entries, type) => entries.filter((e) => e.type === type);

// ---------- Project ----------

export function projectMarkdown(id, { includeTranscripts = false } = {}) {
  const p = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  if (!p) return null;
  const entries = db.prepare("SELECT * FROM knowledge_entries WHERE project_id = ? ORDER BY created_at").all(id);
  const convs = db.prepare(`
    SELECT c.* FROM conversations c JOIN conversation_projects cp ON cp.conversation_id = c.id
    WHERE cp.project_id = ? ORDER BY c.created_at`).all(id);
  const notebooks = db.prepare(`
    SELECT n.* FROM notebooks n JOIN notebook_projects np ON np.notebook_id = n.id
    WHERE np.project_id = ? ORDER BY n.title`).all(id);

  const pending = byType(entries, "pending");
  const open = pending.filter((e) => e.status !== "done");
  const done = pending.filter((e) => e.status === "done");

  const parts = [
    `# Project: ${oneLine(p.title)}\n`,
    `**Status:** ${p.status} · **Last updated:** ${date(p.updated_at)}\n`,
    p.description ? `${p.description.trim()}\n` : "",
    section("Objective", entryList(byType(entries, "objective"))),
    section("Current progress", entryList(byType(entries, "progress"))),
    section("Decisions", entryList(byType(entries, "decision"))),
    section("Open items / next actions", entryList(open, { checkbox: true })),
    section("Completed items", entryList(done, { checkbox: true })),
    section("Ideas", entryList(byType(entries, "idea"))),
    section("Notes", entryList(byType(entries, "note"))),
    section("Links", entryList(byType(entries, "link"))),
    section("Related notebooks", notebooks.map((n) => `- ${oneLine(n.title)}${n.description ? ` — ${oneLine(n.description)}` : ""}`).join("\n")),
    linkedConversationsSection(convs, includeTranscripts),
    `---\n${exportedAt()}\n`,
  ];
  return { title: p.title, markdown: parts.filter(Boolean).join("\n") };
}

// ---------- Notebook ----------

export function notebookMarkdown(id, { includeTranscripts = false } = {}) {
  const nb = db.prepare("SELECT * FROM notebooks WHERE id = ?").get(id);
  if (!nb) return null;
  const entries = db.prepare("SELECT * FROM knowledge_entries WHERE notebook_id = ? ORDER BY created_at").all(id);
  const convs = db.prepare(`
    SELECT c.* FROM conversations c JOIN conversation_notebooks cn ON cn.conversation_id = c.id
    WHERE cn.notebook_id = ? ORDER BY c.created_at`).all(id);
  const projects = db.prepare(`
    SELECT p.* FROM projects p JOIN notebook_projects np ON np.project_id = p.id
    WHERE np.notebook_id = ? ORDER BY p.title`).all(id);

  const parts = [
    `# Notebook: ${oneLine(nb.title)}\n`,
    `**Last updated:** ${date(nb.updated_at)}\n`,
    nb.description ? `${nb.description.trim()}\n` : "",
    section("Instructions", nb.instructions || ""),
    section("Notes", entryList(byType(entries, "note"))),
    section("Ideas", entryList(byType(entries, "idea"))),
    section("Links", entryList(byType(entries, "link"))),
    // Notebooks can hold other entry types created via the API; don't silently drop them.
    section("Other entries", entryList(entries.filter((e) => !["note", "idea", "link"].includes(e.type)))),
    section("Related projects", projects.map((p) => `- ${oneLine(p.title)} (${p.status})`).join("\n")),
    linkedConversationsSection(convs, includeTranscripts),
    `---\n${exportedAt()}\n`,
  ];
  return { title: nb.title, markdown: parts.filter(Boolean).join("\n") };
}

// "My Project: v2!" -> "my-project-v2"
export function slugify(title) {
  return oneLine(title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "export";
}
