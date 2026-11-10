# MyHub — Personal Context Hub

Local-first app to collect, search and export AI conversations (ChatGPT, Claude, Gemini), with notebooks and projects. Runs only on this Mac; no data leaves it.

## Requirements
- Node.js 24+ (built-in `sqlite3` CLI optional, for inspecting data)

## Setup
```bash
cd server && npm install
cd ../client && npm install
```

Copy the config and adjust paths (for local model chat):
```bash
cp server/.env.example server/.env
```

## Run (two terminals)
```bash
cd server && npm run dev   # API on http://127.0.0.1:3001
cd client && npm run dev   # UI  on http://localhost:5173
```

The local model starts automatically on your first chat message (first reply is slower while it loads) and stops when the server stops.

## Useful commands
| Where | Command | Does |
|---|---|---|
| server | `npm test` | Smoke tests (uses a temp database) |
| server | `npm run seed` | Adds demo data if the DB is empty |
| client | `npm run lint` | Lint React code |

## Data location
Everything lives outside the repo:
```
~/Library/Application Support/PersonalContextHub/
  database/context-hub.sqlite   # the database (+ -wal/-shm files)
  imports/original/<provider>/  # untouched, read-only copies of every uploaded export
```
Override with `HUB_DATA_DIR=/some/path`.

Inspect it:
```bash
sqlite3 ~/Library/Application\ Support/PersonalContextHub/database/context-hub.sqlite
```

## Backup
Stop the server, then copy the whole `PersonalContextHub` folder somewhere safe (external disk / cloud drive). Restore = copy it back.

## Project layout
```
server/  app.js (routes), index.js (starts server), db/ (connection + migrations), routes/, scripts/, test/
client/  React + Vite UI (src/components/)
DECISIONS.md  why things are the way they are
```
