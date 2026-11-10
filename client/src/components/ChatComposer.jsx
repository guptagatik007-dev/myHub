import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { SendIcon } from "./Icons.jsx";
import ModelPicker from "./ModelPicker.jsx";
import { useModelChoice } from "../useModelChoice.js";

// Message box for MyHub chats + local model status.
// autoSend: text to send once on mount (first message from the home screen).
export default function ChatComposer({ conversationId, onSent, onPending, autoSend, autoSendModel, onAutoSent }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null); // local model server status
  const autoSentRef = useRef(false);
  const [models, model, setModel] = useModelChoice();

  const refreshStatus = () => api("GET", "/local-model").then(setStatus).catch(() => {});

  async function sendText(content, modelId = model) {
    if (!content || sending) return;
    setSending(true); setError(null);
    onPending(content);
    // Loading takes a while if the model isn't running yet or we're switching.
    setStatus((s) => (s && (s.status !== "ready" || s.model !== modelId) ? { ...s, status: "starting", model: modelId } : s));
    try {
      onSent(await api("POST", `/chats/${conversationId}/messages`, { content, ...(modelId ? { model: modelId } : {}) }));
    } catch (err) {
      setError(err.message);
      onSent(null); // reload: your message was saved even though the reply failed
    } finally {
      setSending(false);
      onPending(null);
      refreshStatus();
    }
  }

  useEffect(() => {
    refreshStatus();
    if (autoSend && !autoSentRef.current) {
      autoSentRef.current = true; // guard: React dev mode runs effects twice
      onAutoSent?.();
      sendText(autoSend, autoSendModel);
    }
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(e) {
    e?.preventDefault();
    const content = text.trim();
    if (!content) return;
    setText("");
    sendText(content);
  }

  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer-box glass">
        <textarea
          rows={2}
          placeholder="Reply…"
          value={text}
          disabled={sending}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) submit(e); }}
        />
        <div className="composer-actions">
          <ModelPicker models={models} value={model} onChange={setModel} disabled={sending} />
          {status && (
            <span className="model-status" title={status.error || ""}>
              <span className={`dot ${status.status}`} aria-hidden="true" />
              <span className="hide-narrow">{status.status === "starting" ? "loading model…" : status.status}</span>
              {status.status === "ready" && !sending && (
                <button type="button" className="btn-link" onClick={async () => setStatus(await api("POST", "/local-model/stop"))}>
                  stop
                </button>
              )}
            </span>
          )}
          <button className="send-btn" disabled={!text.trim() || sending} aria-label="Send"><SendIcon /></button>
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
