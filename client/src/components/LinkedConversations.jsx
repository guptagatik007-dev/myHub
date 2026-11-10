import { Link } from "react-router";

export default function LinkedConversations({ conversations }) {
  return (
    <section className="section">
      <h2 className="section-title">Conversations <span className="count">{conversations.length}</span></h2>
      {conversations.length === 0 ? (
        <p className="placeholder">Link conversations from the Conversations page.</p>
      ) : (
        <ul className="plain-list">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link to={`/conversations/${c.id}`}>{c.title}</Link>
              <span className={`badge ${c.provider}`}>{c.provider}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
