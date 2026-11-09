// Builds the Express app (no listening here, so tests can reuse it).
import express from "express";
import { db } from "./db/index.js";
import conversationsRouter from "./routes/conversations.js";

export const app = express();

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM conversations").get();
  res.json({ status: "ok", time: new Date().toISOString(), conversations: n });
});

app.use("/api/conversations", conversationsRouter);

// Unknown API route -> JSON 404
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

// Any thrown error -> JSON 500 (details only in the server log)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});
