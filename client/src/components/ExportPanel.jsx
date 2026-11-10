import { useEffect, useState } from "react";

// "Export" button -> panel with Markdown preview, Copy and Download.
// kind: "conversation" | "notebook" | "project"
export default function ExportPanel({ kind, id }) {
  const [open, setOpen] = useState(false);
  const [transcripts, setTranscripts] = useState(false);
  const [markdown, setMarkdown] = useState("");
  const [status, setStatus] = useState(null);

  const query = transcripts ? "?transcripts=1" : "";
  const url = `/api/export/${kind}/${id}${query}`;

  useEffect(() => {
    if (!open) return;
    let ignore = false;
    fetch(url)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`Export failed (${res.status})`))))
      .then((text) => { if (!ignore) { setMarkdown(text); setStatus(null); } })
      .catch((e) => !ignore && setStatus(e.message));
    return () => { ignore = true; };
  }, [open, url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setStatus("Copied to clipboard");
    } catch {
      setStatus("Copy failed — select the text and copy manually");
    }
  }

  if (!open) {
    return <button className="btn" onClick={() => setOpen(true)}>Export Markdown</button>;
  }

  const download = `${url}${query ? "&" : "?"}download=1`;
  return (
    <div className="export-panel glass">
      <div className="row export-actions">
        <button className="btn primary" onClick={copy} disabled={!markdown}>Copy</button>
        <a className="btn" href={download} download>Download .md</a>
        {kind !== "conversation" && (
          <label className="check">
            <input type="checkbox" checked={transcripts} onChange={(e) => setTranscripts(e.target.checked)} />
            Include full conversations
          </label>
        )}
        <span className="spacer-flex" />
        <button className="btn" onClick={() => setOpen(false)}>Close</button>
      </div>
      {status && <p className="hint" role="status">{status}</p>}
      <pre className="export-preview">{markdown || "Loading…"}</pre>
    </div>
  );
}
