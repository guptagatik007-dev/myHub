import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { api } from "../api.js";
import { PlusIcon } from "./Icons.jsx";
import { useSidebar } from "../sidebarContext.js";

// The chats that belong to a notebook/project, as cards — shown at the top of the page.
// parent = { notebook_id } or { project_id }
export default function ChatCards({ conversations, parent, label = "notebook" }) {
  const navigate = useNavigate();
  const { refreshSidebar } = useSidebar();
  const [error, setError] = useState(null);

  async function newChat() {
    try {
      const { id } = await api("POST", "/chats", parent);
      refreshSidebar();
      navigate(`/conversations/${id}`);
    } catch (e) { setError(e.message); }
  }

  return (
    <section className="chats-section">
      <div className="chats-head">
        <h2 className="chats-title">Chats <span className="count">{conversations.length}</span></h2>
        <button className="btn" onClick={newChat}><PlusIcon width={14} height={14} /> New chat</button>
      </div>
      {error && <p className="error">{error}</p>}

      {conversations.length === 0 ? (
        <div className="chats-empty glass">
          No chats in this {label} yet. Start one here, or link existing conversations from their "Links & export" menu.
        </div>
      ) : (
        <ul className="chat-cards">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link to={`/conversations/${c.id}`} className="chat-card glass">
                <span className="chat-card-title">{c.title}</span>
                <span className="conv-meta">
                  <span className={`badge ${c.provider}`}>{c.provider}</span>
                  <span>{(c.updated_at || c.created_at)?.slice(0, 10)}</span>
                  {c.message_count !== undefined && <span>{c.message_count} msgs</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
