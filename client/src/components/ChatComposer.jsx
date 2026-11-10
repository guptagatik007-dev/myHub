import { useEffect, useState } from "react";
import { api } from "../api.js";

// Message box for MyHub chats + local model status.
// onSent({ userMessage, assistantMessage }) / onPending(text | null)
export default function ChatComposer({ conversationId, onSent, onPending }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [model, setModel] = useState(null);

  const refreshStatus = () => api("GET", "/local-model").then(setModel).catch(() => {});
  useEffect(() => { refreshStatus(); }, []);

  async function send(e) {
    e?.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true); setError(null);
    onPending(content);
    setText("");
    // Show "starting" if the model isn't loaded yet (first message is slow).
    if (model?.status !== "ready") setModel((m) => m && { ...m, status: "starting" });
    try {
      const result = await api("POST", `/chats/${conversationId}/messages`, { content });
      onSent(result);
    } catch (err) {
      setError(err.message);
      onSent(null); // reload: your message was saved even though the reply failed
    } finally {
      setSending(false);
      onPending(null);
      refreshStatus();
    }
  }

  async function stopModel() {
    setModel(await api("POST", "/local-model/stop"));
  }

  return (
    <form className="composer" onSubmit={send}>
      <textarea
        className="field"
        rows={3}
        placeholder="Message the local model…  (Enter to send, Shift+Enter for new line)"
        value={text}
        disabled={sending}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) send(e);
        }}
      />
      <div className="row">
        <button className="btn primary" disabled={!text.trim() || sending}>
          {sending ? "Waiting…" : "Send"}
        </button>
        {model && (
          <span className="model-status">
            <span className={`dot ${model.status}`} aria-hidden="true" />
            {model.model.split("/").pop()} · {model.status === "starting" ? "loading model (can take a minute)…" : model.status}
          </span>
        )}
        <span className="spacer-flex" />
        {model?.status === "ready" && !sending && (
          <button type="button" className="btn-link" onClick={stopModel}>Stop model</button>
        )}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
