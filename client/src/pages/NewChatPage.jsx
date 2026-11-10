import { useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../api.js";
import { SendIcon } from "../components/Icons.jsx";
import ModelPicker from "../components/ModelPicker.jsx";
import { useModelChoice } from "../useModelChoice.js";

// Home screen: one centered box. First message creates the chat, then opens it.
export default function NewChatPage() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [models, model, setModel] = useModelChoice();

  async function start(e) {
    e?.preventDefault();
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    try {
      const { id } = await api("POST", "/chats");
      // The chat page sends this first message as soon as it opens.
      navigate(`/conversations/${id}`, { state: { firstMessage: content, model } });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="home">
      <h1 className="home-title">What's on your mind?</h1>
      <form className="composer-box glass" onSubmit={start}>
        <textarea
          autoFocus
          rows={3}
          placeholder="Ask anything…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) start(e); }}
        />
        <div className="composer-actions">
          <ModelPicker models={models} value={model} onChange={setModel} disabled={busy} />
          <span className="hint hide-narrow">Enter to send · Shift+Enter for a new line</span>
          <button className="send-btn" disabled={!text.trim() || busy} aria-label="Send"><SendIcon /></button>
        </div>
      </form>
      {error && <p className="error">{error}</p>}
    </main>
  );
}
