#!/usr/bin/env node
// Pretends to be `python -m mlx_lm server` for tests: /health + /v1/chat/completions.
import http from "node:http";
const port = Number(process.argv[process.argv.indexOf("--port") + 1]);
const model = process.argv[process.argv.indexOf("--model") + 1];
http.createServer((req, res) => {
  if (req.url === "/health") return res.end('{"status":"ok"}');
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const { messages, chat_template_kwargs } = JSON.parse(body);
    const last = messages[messages.length - 1].content;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      choices: [{ finish_reason: "stop", message: {
        role: "assistant",
        content: `<think>pondering</think>\nEcho (${messages.length} msgs, thinking=${chat_template_kwargs.enable_thinking}, model=${model}): ${last}`,
      } }],
      usage: { total_tokens: 7 },
    }));
  });
}).listen(port, "127.0.0.1");
