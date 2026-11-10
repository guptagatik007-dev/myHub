// Provider parsers. Each one: async parse(filePath) -> { conversations, warnings }
//
// conversations: [{
//   external_id, title, created_at, updated_at,
//   messages: [{ role, content, created_at, model_name, source_message_id, metadata }]
// }]
// warnings: ["human-readable text", ...]
//
// Parsers must NEVER modify the file they read.

export const IMPORTERS = {
  // chatgpt: (added once we have a real export sample)
  // claude:
  // gemini:
};

export const PROVIDERS = ["chatgpt", "claude", "gemini", "other"];
