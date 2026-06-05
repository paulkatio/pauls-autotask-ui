// Geteilte Anhang-Konstanten – bewusst OHNE "server-only", damit sowohl die
// Upload-Route (server) als auch die Upload-UI (client) dieselbe Grenze nutzen.
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_ATTACHMENT_LABEL = "10 MB";
