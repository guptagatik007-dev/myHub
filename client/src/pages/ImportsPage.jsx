import { useState } from "react";
import { api, useApi } from "../api.js";

const PROVIDERS = [
  ["chatgpt", "ChatGPT"],
  ["claude", "Claude"],
  ["gemini", "Gemini"],
  ["other", "Other"],
];

export default function ImportsPage() {
  const history = useApi("/imports");
  const info = useApi("/imports/info");

  return (
    <main className="page">
      <h1 className="page-title">Imports</h1>
      <p className="muted lead">
        Upload a provider export. The original file is kept unchanged; conversations are parsed into the hub.
      </p>

      <UploadForm onDone={history.reload} />

      <section className="section">
        <h2 className="section-title">History <span className="count">{history.data?.length ?? ""}</span></h2>
        {history.error && <p className="error">{history.error}</p>}
        {history.data?.length === 0 && <p className="placeholder">No imports yet.</p>}
        <ul className="imports">
          {history.data?.map((b) => <ImportRow key={b.id} batch={b} onChange={history.reload} />)}
        </ul>
      </section>

      {info.data && (
        <section className="section">
          <h2 className="section-title">Where your data lives</h2>
          <dl className="info-list">
            <dt>Data folder</dt><dd><code>{info.data.data_dir}</code></dd>
            <dt>Database</dt><dd><code>{info.data.database}</code></dd>
            <dt>Original exports</dt><dd><code>{info.data.originals_dir}</code></dd>
          </dl>
          <p className="hint">To back up, stop the server and copy the whole data folder.</p>
        </section>
      )}
    </main>
  );
}

function UploadForm({ onDone }) {
  const [provider, setProvider] = useState("chatgpt");
  const [label, setLabel] = useState("");
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null); // 0-100 while uploading
  const [message, setMessage] = useState(null);

  function submit(e) {
    e.preventDefault();
    if (!file) return;
    const q = new URLSearchParams({ provider, filename: file.name, ...(label.trim() ? { label: label.trim() } : {}) });

    // XMLHttpRequest instead of fetch: it reports upload progress.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/imports?${q}`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (ev) => ev.lengthComputable && setProgress(Math.round((ev.loaded / ev.total) * 100));
    xhr.onload = () => {
      setProgress(null);
      let body = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* non-JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) {
        setMessage({ ok: true, text: `Uploaded "${file.name}" — ${statusText(body)}` });
        setFile(null);
        e.target.reset();
        onDone();
      } else {
        setMessage({ ok: false, text: body?.error || `Upload failed (${xhr.status})` });
      }
    };
    xhr.onerror = () => { setProgress(null); setMessage({ ok: false, text: "Upload failed — is the server running?" }); };
    setMessage(null);
    setProgress(0);
    xhr.send(file);
  }

  const busy = progress !== null;
  return (
    <form className="upload-form glass" onSubmit={submit}>
      <label>
        <span className="field-label">Provider</span>
        <select value={provider} onChange={(e) => setProvider(e.target.value)} disabled={busy}>
          {PROVIDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label>
        <span className="field-label">Account label <span className="hint">optional</span></span>
        <input className="field" placeholder="e.g. Personal, Work" value={label}
          onChange={(e) => setLabel(e.target.value)} disabled={busy} maxLength={100} />
      </label>
      <label>
        <span className="field-label">Export file <span className="hint">.zip or .json</span></span>
        <input className="file-input" type="file" accept=".zip,.json"
          onChange={(e) => setFile(e.target.files[0] || null)} disabled={busy} />
      </label>
      <div className="row">
        <button className="btn primary" disabled={!file || busy}>
          {busy ? `Uploading… ${progress}%` : "Import"}
        </button>
      </div>
      {busy && <progress className="progress" max="100" value={progress} />}
      {message && <p className={message.ok ? "success" : "error"} role="status">{message.text}</p>}
    </form>
  );
}

function ImportRow({ batch: b, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const r = b.report || {};
  const notes = [...(r.warnings || []), ...(r.errors || [])];

  async function process() {
    setBusy(true);
    try { await api("POST", `/imports/${b.id}/process`); setError(null); onChange(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <li className="import-row">
      <div className="import-main">
        <div>
          <div className="conv-title">{b.original_filename}</div>
          <div className="conv-meta">
            <span className={`badge ${b.provider}`}>{b.provider}</span>
            {b.account_label && <span>{b.account_label}</span>}
            <span>{b.imported_at.slice(0, 16).replace("T", " ")}</span>
            <span>{formatBytes(b.size_bytes)}</span>
          </div>
        </div>
        <span className={`import-status ${b.status}`}>{b.status}</span>
      </div>

      {r.total !== undefined && (
        <p className="import-counts">
          {r.imported} imported · {r.skipped} already in hub · {r.failed} failed · {r.messages} messages
        </p>
      )}
      {notes.length > 0 && (
        <details className="import-notes">
          <summary>{notes.length} note{notes.length > 1 ? "s" : ""}</summary>
          <ul>{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </details>
      )}
      <p className="hint"><code>{b.stored_path}</code></p>
      {b.status === "stored" && (
        <button className="btn" onClick={process} disabled={busy || !b.has_importer}
          title={b.has_importer ? "" : "Importer for this provider isn't built yet"}>
          {busy ? "Processing…" : b.has_importer ? "Process now" : "Waiting for importer"}
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </li>
  );
}

function statusText(b) {
  if (!b) return "done";
  if (b.status === "stored") return "original saved. It will be parsed once the importer exists.";
  if (b.status === "failed") return "could not be parsed (original kept).";
  const r = b.report || {};
  return `${r.imported} conversations imported, ${r.skipped} already in hub.`;
}

function formatBytes(n) {
  if (!n) return "";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}
