import { useCallback, useState } from "react";
import { Route, Routes } from "react-router";
import Sidebar from "./components/Sidebar.jsx";
import { MenuIcon } from "./components/Icons.jsx";
import { SidebarContext } from "./sidebarContext.js";
import NewChatPage from "./pages/NewChatPage.jsx";
import ConversationsPage from "./pages/ConversationsPage.jsx";
import NotebooksPage from "./pages/NotebooksPage.jsx";
import ProjectsPage from "./pages/ProjectsPage.jsx";
import ImportsPage from "./pages/ImportsPage.jsx";
import Placeholder from "./pages/Placeholder.jsx";
import "./App.css";

// Remember the collapsed state between visits (per browser; safe if storage is blocked).
const readCollapsed = () => { try { return localStorage.getItem("sidebarCollapsed") === "1"; } catch { return false; } };

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const refreshSidebar = useCallback(() => setRefreshKey((k) => k + 1), []);

  function toggle() {
    // On phones the button closes the drawer; on desktop it collapses the sidebar.
    if (mobileOpen) return setMobileOpen(false);
    setCollapsed((c) => {
      try { localStorage.setItem("sidebarCollapsed", c ? "0" : "1"); } catch { /* ignore */ }
      return !c;
    });
  }

  return (
    <SidebarContext.Provider value={{ refreshSidebar }}>
      <div className={`shell ${mobileOpen ? "drawer-open" : ""}`}>
        <Sidebar refreshKey={refreshKey} collapsed={collapsed && !mobileOpen} onToggle={toggle}
          onNavigate={() => setMobileOpen(false)} />
        <div className="scrim" onClick={() => setMobileOpen(false)} aria-hidden="true" />

        <div className="main">
          <header className="mobile-bar">
            <button className="icon-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu"><MenuIcon /></button>
            <span className="brand">MyHub</span>
          </header>

          <Routes>
            <Route path="/" element={<NewChatPage />} />
            <Route path="/conversations" element={<ConversationsPage />} />
            <Route path="/conversations/:id" element={<ConversationsPage />} />
            <Route path="/notebooks" element={<NotebooksPage />} />
            <Route path="/notebooks/:id" element={<NotebooksPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectsPage />} />
            <Route path="/imports" element={<ImportsPage />} />
            <Route path="*" element={<Placeholder title="Page not found" />} />
          </Routes>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
