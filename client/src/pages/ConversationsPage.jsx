import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { api } from "../api.js";
import ConversationList from "../components/ConversationList.jsx";
import ConversationView from "../components/ConversationView.jsx";

// The selected conversation comes from the URL: /conversations/:id
export default function ConversationsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const selectedId = id ? Number(id) : null;
  const [listVersion, setListVersion] = useState(0); // bump to refresh the sidebar
  const [error, setError] = useState(null);

  async function newChat() {
    try {
      const { id: newId } = await api("POST", "/chats");
      setListVersion((v) => v + 1);
      navigate(`/conversations/${newId}`);
    } catch (e) { setError(e.message); }
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <button className="btn primary full" onClick={newChat}>+ New chat</button>
        {error && <p className="error">{error}</p>}
        <ConversationList
          selectedId={selectedId}
          refreshKey={listVersion}
          onSelect={(convId) => navigate(`/conversations/${convId}`)}
        />
      </aside>
      <main className="content">
        {selectedId ? (
          <ConversationView key={selectedId} id={selectedId} onChange={() => setListVersion((v) => v + 1)} />
        ) : (
          <p className="empty">
            <strong>No conversation selected</strong>
            Pick one from the list, search across all providers, or start a new chat.
          </p>
        )}
      </main>
    </div>
  );
}
