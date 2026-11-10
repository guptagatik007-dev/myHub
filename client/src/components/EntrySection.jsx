import { useState } from "react";
import { api } from "../api.js";
import EditableText from "./EditableText.jsx";

// One section of knowledge entries of a single type (e.g. all "decision" entries).
// parent = { project_id } or { notebook_id }
export default function EntrySection({ title, type, entries, parent, onChange, hint }) {
  const [draft, setDraft] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [error, setError] = useState(null);
  const items = entries.filter((e) => e.type === type);
  const isLink = type === "link";

  async function add(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    try {
      await api("POST", "/entries", { type, content: draft, title: isLink ? linkTitle || null : null, ...parent });
      setDraft(""); setLinkTitle(""); setError(null);
      onChange();
    } catch (err) { setError(err.message); }
  }

  async function update(id, fields) {
    await api("PATCH", `/entries/${id}`, fields);
    onChange();
  }

  async function remove(id) {
    if (!window.confirm("Delete this entry?")) return;
    await api("DELETE", `/entries/${id}`);
    onChange();
  }

  return (
    <section className="section">
      <h2 className="section-title">
        {title} <span className="count">{items.length}</span>
      </h2>
      {items.length === 0 && hint && <p className="placeholder">{hint}</p>}

      <ul className="entries">
        {items.map((entry) => (
          <li key={entry.id} className={`entry ${entry.status === "done" ? "done" : ""}`}>
            {type === "pending" && (
              <input
                type="checkbox"
                aria-label="Mark done"
                checked={entry.status === "done"}
                onChange={(e) => update(entry.id, { status: e.target.checked ? "done" : "open" })}
              />
            )}
            <div className="entry-body">
              {isLink ? (
                <LinkEntry entry={entry} />
              ) : (
                <EditableText value={entry.content} onSave={(content) => update(entry.id, { content })} />
              )}
            </div>
            <button className="btn-link danger" aria-label="Delete entry" onClick={() => remove(entry.id)}>
              Delete
            </button>
          </li>
        ))}
      </ul>

      <form className="add-form" onSubmit={add}>
        {isLink && (
          <input className="field" placeholder="Label (optional)" value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)} />
        )}
        <input
          className="field"
          placeholder={isLink ? "https://…" : `Add ${title.toLowerCase()}…`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="btn" disabled={!draft.trim()}>Add</button>
      </form>
      {error && <p className="error">{error}</p>}
    </section>
  );
}

// Only http(s) links become clickable; anything else is shown as plain text.
function LinkEntry({ entry }) {
  const safe = /^https?:\/\//i.test(entry.content);
  const label = entry.title || entry.content;
  return safe ? (
    <a href={entry.content} target="_blank" rel="noopener noreferrer" className="ext-link">{label}</a>
  ) : (
    <span>{label}</span>
  );
}
