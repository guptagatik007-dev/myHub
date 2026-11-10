import { useLocation, useNavigate, useParams } from "react-router";
import ConversationList from "../components/ConversationList.jsx";
import ConversationView from "../components/ConversationView.jsx";
import { useSidebar } from "../sidebarContext.js";

// /conversations      -> search & browse everything
// /conversations/:id  -> read (or continue) one conversation
export default function ConversationsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshSidebar } = useSidebar();

  if (id) {
    return (
      <main className="page page-chat">
        <ConversationView
          key={id}
          id={Number(id)}
          firstMessage={location.state?.firstMessage}
          firstModel={location.state?.model}
          onFirstMessageSent={() => navigate(location.pathname, { replace: true, state: null })}
          onChange={refreshSidebar}
        />
      </main>
    );
  }

  return (
    <main className="page">
      <h1 className="page-title">Search</h1>
      <p className="muted lead">Every conversation, across all providers.</p>
      <ConversationList onSelect={(convId) => navigate(`/conversations/${convId}`)} />
    </main>
  );
}
