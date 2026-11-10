import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api } from "../api.js";

// Shows linked items as chips (with ×) and a dropdown to link more.
// linkPath(otherId) -> "/links/conversation/1/notebook/<otherId>"
export default function LinkPicker({ label, kind, linked, linkPath, onChange }) {
  const [options, setOptions] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("GET", `/${kind}`).then(setOptions).catch((e) => setError(e.message));
  }, [kind]);

  const linkedIds = new Set(linked.map((x) => x.id));
  const available = options.filter((o) => !linkedIds.has(o.id));

  async function run(method, id) {
    try { await api(method, linkPath(id)); setError(null); onChange(); }
    catch (e) { setError(e.message); }
  }

  return (
    <div className="link-picker">
      <span className="link-label">{label}</span>
      {linked.map((item) => (
        <span key={item.id} className="chip">
          <Link to={`/${kind}/${item.id}`}>{item.title}</Link>
          <button aria-label={`Unlink ${item.title}`} onClick={() => run("DELETE", item.id)}>×</button>
        </span>
      ))}
      {available.length > 0 && (
        <select
          className="chip-select"
          aria-label={`Link a ${label.toLowerCase()}`}
          value=""
          onChange={(e) => e.target.value && run("PUT", Number(e.target.value))}
        >
          <option value="">+ Add</option>
          {available.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
        </select>
      )}
      {linked.length === 0 && available.length === 0 && <span className="placeholder">None yet</span>}
      {error && <span className="error">{error}</span>}
    </div>
  );
}
