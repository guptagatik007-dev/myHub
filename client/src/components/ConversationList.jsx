import { useEffect, useState } from "react";

const PROVIDERS = ["", "hub", "chatgpt", "claude", "gemini", "other"];

export default function ConversationList({ selectedId, onSelect, refreshKey = 0 }) {
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("");
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState(null);

  // Re-fetch when search or filter changes (small delay so we don't fetch on every keystroke).
  useEffect(() => {
    let ignore = false; // ignore out-of-order responses from older searches
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: query, provider });
      fetch(`/api/conversations?${params}`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Server error ${res.status}`))))
        .then((data) => { if (!ignore) { setConversations(data); setError(null); } })
        .catch((err) => !ignore && setError(err.message));
    }, 250);
    return () => { ignore = true; clearTimeout(timer); };
  }, [query, provider, refreshKey]);

  return (
    <div>
      <div className="search-row">
      <input
        className="search"
        type="search"
        aria-label="Search conversations"
        placeholder="Search titles and messages…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <select aria-label="Filter by provider" value={provider} onChange={(e) => setProvider(e.target.value)}>
        {PROVIDERS.map((p) => (
          <option key={p} value={p}>{p === "hub" ? "MyHub chats" : p || "All providers"}</option>
        ))}
      </select>
      </div>

      {error && <p className="error">{error}</p>}
      {!error && conversations.length === 0 && (
        <p className="empty">
          <strong>No conversations found</strong>
          {query || provider ? "Try a different search or filter." : "Import an export from the Imports page."}
        </p>
      )}

      <ul className="conv-list">
        {conversations.map((c) => (
          <li key={c.id}>
            {/* A real button: works with keyboard (Tab + Enter) */}
            <button
              className={`conv-item ${c.id === selectedId ? "selected" : ""}`}
              aria-current={c.id === selectedId ? "true" : undefined}
              onClick={() => onSelect(c.id)}
            >
              <div className="conv-title">{c.title}</div>
              <div className="conv-meta">
                <span className={`badge ${c.provider}`}>{c.provider}</span>
                <span>{c.created_at?.slice(0, 10)}</span>
                <span>{c.message_count} messages</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
