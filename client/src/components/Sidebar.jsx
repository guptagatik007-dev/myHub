import { NavLink, useNavigate } from "react-router";
import { useApi } from "../api.js";
import { BookIcon, FolderIcon, PanelIcon, PlusIcon, SearchIcon, UploadIcon } from "./Icons.jsx";

const NAV = [
  ["/conversations", "Search", SearchIcon],
  ["/notebooks", "Notebooks", BookIcon],
  ["/projects", "Projects", FolderIcon],
  ["/imports", "Imports", UploadIcon],
];

export default function Sidebar({ refreshKey, collapsed, onToggle, onNavigate }) {
  const navigate = useNavigate();
  const recent = useApi(`/conversations?limit=40&v=${refreshKey}`);

  return (
    <aside className={`app-sidebar glass ${collapsed ? "collapsed" : ""}`} aria-label="Main">
      <div className="sidebar-head">
        <span className="brand">MyHub</span>
        <button className="icon-btn" onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <PanelIcon />
        </button>
      </div>

      <button className="new-chat" onClick={() => { navigate("/"); onNavigate?.(); }}>
        <PlusIcon /> <span className="label">New chat</span>
      </button>

      <nav className="side-nav">
        {NAV.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} end={to === "/conversations"} onClick={onNavigate} title={label}>
            <Icon /> <span className="label">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="recent">
        <div className="recent-title label">Recent</div>
        {recent.data?.length === 0 && <p className="placeholder label">No conversations yet</p>}
        <ul>
          {recent.data?.map((c) => (
            <li key={c.id}>
              <NavLink to={`/conversations/${c.id}`} onClick={onNavigate} title={c.title}>
                <span className={`provider-dot ${c.provider}`} aria-hidden="true" />
                <span className="recent-text">{c.title}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
