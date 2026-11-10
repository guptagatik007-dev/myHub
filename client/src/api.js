import { useCallback, useEffect, useState } from "react";

// Small fetch wrapper: JSON in/out, throws Error(message) on non-2xx.
export async function api(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

// Loads data for a component and lets it reload after edits.

export function useApi(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let ignore = false;
    api("GET", path)
      .then((d) => { if (!ignore) { setData(d); setError(null); } })
      .catch((e) => !ignore && setError(e.message));
    return () => { ignore = true; };
  }, [path, version]);

  return { data, error, reload };
}
