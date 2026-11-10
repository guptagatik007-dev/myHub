import { useNavigate, useParams } from "react-router";
import ConversationList from "../components/ConversationList.jsx";
import ConversationView from "../components/ConversationView.jsx";

// The selected conversation comes from the URL: /conversations/:id
export default function ConversationsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const selectedId = id ? Number(id) : null;

  return (
    <div className="layout">
      <aside className="sidebar">
        <ConversationList
          selectedId={selectedId}
          onSelect={(convId) => navigate(`/conversations/${convId}`)}
        />
      </aside>
      <main className="content">
        {selectedId ? (
          <ConversationView key={selectedId} id={selectedId} />
        ) : (
          <p className="muted">Select a conversation.</p>
        )}
      </main>
    </div>
  );
}
