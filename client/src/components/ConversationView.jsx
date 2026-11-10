import { useEffect, useState } from "react";
import LinkPicker from "./LinkPicker.jsx";

export default function ConversationView({ id }) {
  const [conv, setConv] = useState(null);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0); // bump to reload after linking

  // Parent remounts this component per id (key={id}), so state starts fresh.
  useEffect(() => {
    let ignore = false; // drop the response if the user already moved on
    fetch(`/api/conversations/${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Not found"))))
      .then((data) => !ignore && setConv(data))
      .catch((err) => !ignore && setError(err.message));
    return () => { ignore = true; };
  }, [id, version]);

  if (error) return <p className="error">{error}</p>;
  if (!conv) return <p className="muted">Loading…</p>;

  return (
    <article>
      <h1 className="page-title">{conv.title}</h1>
      <div className="page-meta">
        <span className={`badge ${conv.provider}`}>{conv.provider}</span>
        <span>{conv.created_at?.slice(0, 10)}</span>
        <span>{conv.messages.length} messages</span>
      </div>
      <LinkPicker label="Notebooks" kind="notebooks" linked={conv.notebooks}
        linkPath={(nid) => `/links/conversation/${conv.id}/notebook/${nid}`} onChange={() => setVersion((v) => v + 1)} />
      <LinkPicker label="Projects" kind="projects" linked={conv.projects}
        linkPath={(pid) => `/links/conversation/${conv.id}/project/${pid}`} onChange={() => setVersion((v) => v + 1)} />
      <div className="spacer" />

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
