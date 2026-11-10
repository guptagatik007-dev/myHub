# Decisions

- **Plain JavaScript**, ES modules (`"type": "module"`).
- **Express on 3001, Vite on 5173**; Vite proxies `/api` → no CORS setup.
- **SQLite via better-sqlite3** — local, single file, relational links.
- **Data dir:** `~/Library/Application Support/PersonalContextHub/` (override with `HUB_DATA_DIR`). Never inside the repo.
- **Migrations:** numbered `.sql` files in `server/db/migrations`; SQLite `user_version` tracks the last applied.
- **Duplicate imports:** blocked by `UNIQUE(provider, external_id)` on conversations.
- **Links** (conversation↔notebook/project) are join tables; a conversation is stored once.
- **Knowledge entry type `link`** added (handoff list + `link`) for notebook web references.
- **Server binds to 127.0.0.1 only** — not reachable from the local network.
- **`app.js` / `index.js` split** so tests can start the app on a random port.
- **Tests:** Node's built-in `node:test` + `fetch`, no test libraries.
- **UI: dark theme, minimal.** All colors/spacing/type are tokens at the top of `client/src/App.css`. One accent (amber). System fonts only (no external font requests — local-first). Provider shown as dot + text label, never color alone.
