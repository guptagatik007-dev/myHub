import { Navigate, NavLink, Route, Routes } from "react-router";
import ConversationsPage from "./pages/ConversationsPage.jsx";
import Placeholder from "./pages/Placeholder.jsx";
import "./App.css";

const NAV = [
  ["/conversations", "Conversations"],
  ["/notebooks", "Notebooks"],
  ["/projects", "Projects"],
  ["/imports", "Imports"],
];

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">MyHub</span>
        <nav>
          {NAV.map(([to, label]) => (
            <NavLink key={to} to={to}>{label}</NavLink>
          ))}
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Navigate to="/conversations" replace />} />
        <Route path="/conversations" element={<ConversationsPage />} />
        <Route path="/conversations/:id" element={<ConversationsPage />} />
        <Route path="/notebooks/*" element={<Placeholder title="Notebooks" />} />
        <Route path="/projects/*" element={<Placeholder title="Projects" />} />
        <Route path="/imports" element={<Placeholder title="Imports" />} />
        <Route path="*" element={<Placeholder title="Page not found" />} />
      </Routes>
    </div>
  );
}
