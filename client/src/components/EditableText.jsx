import { useState } from "react";

// Shows text; click "Edit" to change it. Calls onSave(newValue).
export default function EditableText({ value, onSave, placeholder = "Empty", multiline = true, className = "" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [error, setError] = useState(null);

  async function save() {
    try {
      await onSave(draft);
      setEditing(false);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  if (!editing) {
    return (
      <div className={`editable ${className}`}>
        {value ? <div className="text">{value}</div> : <div className="placeholder">{placeholder}</div>}
        <button className="btn-link" onClick={() => { setDraft(value || ""); setEditing(true); }}>Edit</button>
      </div>
    );
  }

  const Field = multiline ? "textarea" : "input";
  return (
    <div className="edit-form">
      <Field
        className="field"
        value={draft}
        autoFocus
        rows={multiline ? 4 : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
          if (e.key === "Enter" && (!multiline || e.metaKey)) save();
        }}
      />
      <div className="row">
        <button className="btn primary" onClick={save}>Save</button>
        <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
        {multiline && <span className="hint">⌘ Enter to save</span>}
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
