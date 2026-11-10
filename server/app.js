// Builds the Express app (no listening here, so tests can reuse it).
import express from "express";
import { db } from "./db/index.js";
import conversationsRouter from "./routes/conversations.js";
import notebooksRouter from "./routes/notebooks.js";
import projectsRouter from "./routes/projects.js";
import entriesRouter from "./routes/entries.js";
import linksRouter from "./routes/links.js";

export const app = express();

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM conversations").get();
  res.json({ status: "ok", time: new Date().toISOString(), conversations: n });
});

app.use("/api/conversations", conversationsRouter);
app.use("/api/notebooks", notebooksRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/entries", entriesRouter);
app.use("/api/links", linksRouter);

// Unknown API route -> JSON 404
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

// Errors -> JSON. 400s (bad input, bad JSON) show their message; others are hidden.
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
  res.status(status).json({ error: err.expose === false ? "Bad request" : err.message });
});
