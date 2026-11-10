import { NavLink, useNavigate, useParams } from "react-router";
import { api, useApi } from "../api.js";
import CreateForm from "../components/CreateForm.jsx";
import EditableText from "../components/EditableText.jsx";
import EntrySection from "../components/EntrySection.jsx";
import LinkPicker from "../components/LinkPicker.jsx";
import LinkedConversations from "../components/LinkedConversations.jsx";
import ExportPanel from "../components/ExportPanel.jsx";

const STATUSES = ["active", "paused", "done"];

export default function ProjectsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const list = useApi("/projects");

  async function create(title) {
    const p = await api("POST", "/projects", { title });
    list.reload();
    navigate(`/projects/${p.id}`);
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <CreateForm label="project" onCreate={create} />
        {list.error && <p className="error">{list.error}</p>}
        {list.data?.length === 0 && (
          <p className="empty"><strong>No projects yet</strong>Track an objective, decisions, progress and next steps.</p>
        )}
        <ul className="nav-list">
          {list.data?.map((p) => (
            <li key={p.id}>
              <NavLink to={`/projects/${p.id}`} className="nav-item">
                <div className="conv-title">{p.title}</div>
                <div className="conv-meta">
                  <span className={`status ${p.status}`}>{p.status}</span>
                  <span>{p.open_pending} open</span>
                  <span>{p.conversation_count} conversations</span>
                </div>
              </NavLink>
            </li>
          ))}
        </ul>
      </aside>
      <main className="content">
        {id ? (
          <ProjectView key={id} id={id} onChange={list.reload} onDeleted={() => { list.reload(); navigate("/projects"); }} />
        ) : (
          <p className="empty"><strong>No project selected</strong>Pick one, or create a new project.</p>
        )}
      </main>
    </div>
  );
}

function ProjectView({ id, onChange, onDeleted }) {
  const { data: p, error, reload } = useApi(`/projects/${id}`);
  if (error) return <p className="error">{error}</p>;
  if (!p) return <p className="muted">Loading…</p>;

  const refresh = () => { reload(); onChange(); };
  const patch = async (fields) => { await api("PATCH", `/projects/${id}`, fields); refresh(); };
  const remove = async () => {
    if (!window.confirm(`Delete project "${p.title}" and its entries? Conversations are kept.`)) return;
    await api("DELETE", `/projects/${id}`);
    onDeleted();
  };
  const parent = { project_id: p.id };

  return (
    <article>
      <EditableText className="title-edit" value={p.title} multiline={false} onSave={(title) => patch({ title })} />

      <div className="page-meta">
        <label className="status-select">
          Status
          <select value={p.status} onChange={(e) => patch({ status: e.target.value })}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <LinkPicker label="Notebooks" kind="notebooks" linked={p.notebooks}
        linkPath={(nid) => `/links/notebook/${nid}/project/${p.id}`} onChange={reload} />

      <section className="section">
        <h2 className="section-title">Description</h2>
        <EditableText value={p.description} placeholder="A short description." onSave={(description) => patch({ description })} />
      </section>

      <EntrySection title="Objective" type="objective" entries={p.entries} parent={parent} onChange={refresh}
        hint="What are you trying to achieve?" />
      <EntrySection title="Pending" type="pending" entries={p.entries} parent={parent} onChange={refresh}
        hint="Open questions and next actions." />
      <EntrySection title="Progress" type="progress" entries={p.entries} parent={parent} onChange={refresh}
        hint="What's done or underway." />
      <EntrySection title="Decisions" type="decision" entries={p.entries} parent={parent} onChange={refresh}
        hint="Choices made, and why." />
      <EntrySection title="Notes" type="note" entries={p.entries} parent={parent} onChange={refresh} />
      <LinkedConversations conversations={p.conversations} />

      <section className="section">
        <h2 className="section-title">Export</h2>
        <ExportPanel kind="project" id={p.id} />
      </section>

      <div className="danger-zone">
        <button className="btn danger" onClick={remove}>Delete project</button>
      </div>
    </article>
  );
}
