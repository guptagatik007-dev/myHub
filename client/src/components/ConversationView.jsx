import { useEffect, useRef, useState } from "react";
import LinkPicker from "./LinkPicker.jsx";
import ExportPanel from "./ExportPanel.jsx";
import ChatComposer from "./ChatComposer.jsx";

export default function ConversationView({ id, onChange }) {
  const [conv, setConv] = useState(null);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0); // bump to reload
  const [pending, setPending] = useState(null); // your message while waiting for a reply
  const endRef = useRef(null);

  // Parent remounts this component per id (key={id}), so state starts fresh.
  useEffect(() => {
    let ignore = false; // drop the response if the user already moved on
    fetch(`/api/conversations/${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Not found"))))
      .then((data) => !ignore && setConv(data))
      .catch((err) => !ignore && setError(err.message));
    return () => { ignore = true; };
  }, [id, version]);

  // Keep the newest message in view while chatting.
  const count = conv?.messages.length;
  useEffect(() => {
    if (pending || version) endRef.current?.scrollIntoView({ block: "end" });
  }, [pending, count, version]);

  if (error) return <p className="error">{error}</p>;
  if (!conv) return <p className="muted">Loading…</p>;

  const isHubChat = conv.provider === "hub";
  const reload = () => setVersion((v) => v + 1);

  return (
    <article>
      <h1 className="page-title">{conv.title}</h1>
      <div className="page-meta">
        <span className={`badge ${conv.provider}`}>{conv.provider}</span>
        <span>{conv.created_at?.slice(0, 10)}</span>
        <span>{conv.messages.length} messages</span>
      </div>
      <LinkPicker label="Notebooks" kind="notebooks" linked={conv.notebooks}
        linkPath={(nid) => `/links/conversation/${conv.id}/notebook/${nid}`} onChange={reload} />
      <LinkPicker label="Projects" kind="projects" linked={conv.projects}
        linkPath={(pid) => `/links/conversation/${conv.id}/project/${pid}`} onChange={reload} />
      {conv.messages.length > 0 && <ExportPanel kind="conversation" id={conv.id} />}
      <div className="spacer" />

      {conv.messages.length === 0 && !pending && isHubChat && (
        <p className="empty"><strong>New chat</strong>Runs on your Mac with the local model. Nothing leaves this machine.</p>
      )}

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

      {pending && (
        <>
          <div className="message user"><div className="role">user</div><div className="text">{pending}</div></div>
          <div className="message assistant"><div className="role">assistant</div><div className="text muted typing">Thinking…</div></div>
        </>
      )}
      <div ref={endRef} />

      {isHubChat && (
        <ChatComposer
          conversationId={conv.id}
          onPending={setPending}
          onSent={() => { reload(); onChange?.(); }}
        />
      )}
    </article>
  );
}
