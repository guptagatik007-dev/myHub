import { useEffect, useState } from "react";
import { api } from "./api.js";

const KEY = "chatModel";
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (v) => { try { localStorage.setItem(KEY, v); } catch { /* ignore */ } };

/** Remembers your last chosen model (per browser). Returns [models, model, setModel]. */
export function useModelChoice() {
  const [models, setModels] = useState([]);
  const [model, setModelState] = useState(read);

  useEffect(() => {
    api("GET", "/models").then(({ models: list, default: def }) => {
      setModels(list);
      // Fall back to the default if the saved choice is gone or unavailable.
      setModelState((cur) => (list.some((m) => m.id === cur && m.available) ? cur : def));
    }).catch(() => {});
  }, []);

  const setModel = (id) => { setModelState(id); write(id); };
  return [models, model, setModel];
}
