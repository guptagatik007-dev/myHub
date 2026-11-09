import { useEffect, useState } from "react";

const PROVIDERS = ["", "chatgpt", "claude", "gemini", "other"];

export default function ConversationList({ selectedId, onSelect }) {
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
  }, [query, provider]);

  return (
    <div>
      <input
        className="search"
        placeholder="Search titles and messages…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <select value={provider} onChange={(e) => setProvider(e.target.value)}>
        {PROVIDERS.map((p) => (
          <option key={p} value={p}>{p || "All providers"}</option>
        ))}
      </select>

      {error && <p className="error">{error}</p>}
      {!error && conversations.length === 0 && <p className="muted">No conversations.</p>}

      <ul className="conv-list">
        {conversations.map((c) => (
          <li
            key={c.id}
            className={c.id === selectedId ? "selected" : ""}
            onClick={() => onSelect(c.id)}
          >
            <div className="conv-title">{c.title}</div>
            <div className="conv-meta">
              <span className={`badge ${c.provider}`}>{c.provider}</span>
              {c.created_at?.slice(0, 10)} · {c.message_count} msgs
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
