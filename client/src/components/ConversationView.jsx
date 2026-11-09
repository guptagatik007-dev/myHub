import { useEffect, useState } from "react";

export default function ConversationView({ id }) {
  const [conv, setConv] = useState(null);
  const [error, setError] = useState(null);

  // Parent remounts this component per id (key={id}), so state starts fresh.
  useEffect(() => {
    let ignore = false; // drop the response if the user already moved on
    fetch(`/api/conversations/${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Not found"))))
      .then((data) => !ignore && setConv(data))
      .catch((err) => !ignore && setError(err.message));
    return () => { ignore = true; };
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!conv) return <p className="muted">Loading…</p>;

  return (
    <article>
      <h2>{conv.title}</h2>
      <p className="conv-meta">
        <span className={`badge ${conv.provider}`}>{conv.provider}</span>
        {conv.created_at?.slice(0, 10)}
        {conv.notebooks.length > 0 && <> · Notebooks: {conv.notebooks.map((n) => n.title).join(", ")}</>}
        {conv.projects.length > 0 && <> · Projects: {conv.projects.map((p) => p.title).join(", ")}</>}
      </p>

      {conv.messages.map((m) => (
        <div key={m.id} className={`message ${m.role}`}>
          <div className="role">
            {m.role}
            {m.model_name && <span className="muted"> · {m.model_name}</span>}
          </div>
          {/* Plain text rendering: imported content is data, never HTML. */}
          <div className="text">{m.content}</div>
        </div>
      ))}
    </article>
  );
}
