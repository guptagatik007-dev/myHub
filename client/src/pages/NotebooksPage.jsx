import { NavLink, useNavigate, useParams } from "react-router";
import { api, useApi } from "../api.js";
import CreateForm from "../components/CreateForm.jsx";
import EditableText from "../components/EditableText.jsx";
import EntrySection from "../components/EntrySection.jsx";
import LinkPicker from "../components/LinkPicker.jsx";
import LinkedConversations from "../components/LinkedConversations.jsx";

export default function NotebooksPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const list = useApi("/notebooks");

  async function create(title) {
    const nb = await api("POST", "/notebooks", { title });
    list.reload();
    navigate(`/notebooks/${nb.id}`);
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <CreateForm label="notebook" onCreate={create} />
        {list.error && <p className="error">{list.error}</p>}
        {list.data?.length === 0 && (
          <p className="empty"><strong>No notebooks yet</strong>Collect notes, links and conversations on a topic.</p>
        )}
        <ul className="nav-list">
          {list.data?.map((nb) => (
            <li key={nb.id}>
              <NavLink to={`/notebooks/${nb.id}`} className="nav-item">
                <div className="conv-title">{nb.title}</div>
                <div className="conv-meta">
                  <span>{nb.entry_count} entries</span>
                  <span>{nb.conversation_count} conversations</span>
                </div>
              </NavLink>
            </li>
          ))}
        </ul>
      </aside>
      <main className="content">
        {id ? (
          <NotebookView key={id} id={id} onChange={list.reload} onDeleted={() => { list.reload(); navigate("/notebooks"); }} />
        ) : (
          <p className="empty"><strong>No notebook selected</strong>Pick one, or create a new notebook.</p>
        )}
      </main>
    </div>
  );
}

function NotebookView({ id, onChange, onDeleted }) {
  const { data: nb, error, reload } = useApi(`/notebooks/${id}`);
  if (error) return <p className="error">{error}</p>;
  if (!nb) return <p className="muted">Loading…</p>;

  const refresh = () => { reload(); onChange(); };
  const patch = async (fields) => { await api("PATCH", `/notebooks/${id}`, fields); refresh(); };
  const remove = async () => {
    if (!window.confirm(`Delete notebook "${nb.title}" and its notes? Conversations are kept.`)) return;
    await api("DELETE", `/notebooks/${id}`);
    onDeleted();
  };
  const parent = { notebook_id: nb.id };

  return (
    <article>
      <EditableText className="title-edit" value={nb.title} multiline={false} onSave={(title) => patch({ title })} />

      <LinkPicker label="Projects" kind="projects" linked={nb.projects}
        linkPath={(pid) => `/links/notebook/${nb.id}/project/${pid}`} onChange={reload} />

      <section className="section">
        <h2 className="section-title">Description</h2>
        <EditableText value={nb.description} placeholder="What is this notebook about?" onSave={(description) => patch({ description })} />
      </section>
      <section className="section">
        <h2 className="section-title">Instructions</h2>
        <EditableText value={nb.instructions} placeholder="Context or instructions to include when exporting." onSave={(instructions) => patch({ instructions })} />
      </section>

      <EntrySection title="Notes" type="note" entries={nb.entries} parent={parent} onChange={refresh} />
      <EntrySection title="Ideas" type="idea" entries={nb.entries} parent={parent} onChange={refresh} />
      <EntrySection title="Links" type="link" entries={nb.entries} parent={parent} onChange={refresh} />
      <LinkedConversations conversations={nb.conversations} />

      <div className="danger-zone">
        <button className="btn danger" onClick={remove}>Delete notebook</button>
      </div>
    </article>
  );
}
