import { app } from "./app.js";

const PORT = process.env.PORT || 3001;
const HOST = "127.0.0.1"; // local machine only — not reachable from your network

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
