import { useState } from "react";

// "New notebook" / "New project" inline form. onCreate(title) returns the new item.
export default function CreateForm({ label, onCreate }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    try {
      await onCreate(title);
      setTitle(""); setOpen(false); setError(null);
    } catch (err) { setError(err.message); }
  }

  if (!open) return <button className="btn primary full" onClick={() => setOpen(true)}>+ New {label}</button>;

  return (
    <form className="create-form" onSubmit={submit}>
      <input className="field" autoFocus placeholder={`${label[0].toUpperCase() + label.slice(1)} title`}
        value={title} onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)} />
      <div className="row">
        <button className="btn primary" disabled={!title.trim()}>Create</button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
