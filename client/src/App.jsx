import { useState } from "react";
import ConversationList from "./components/ConversationList.jsx";
import ConversationView from "./components/ConversationView.jsx";
import "./App.css";

export default function App() {
  const [selectedId, setSelectedId] = useState(null);

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>MyHub</h1>
        <ConversationList selectedId={selectedId} onSelect={setSelectedId} />
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
