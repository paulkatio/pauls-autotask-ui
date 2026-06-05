import { handlers } from "@/lib/auth/authjs";

// Node-Runtime (kein Edge): der jwt-Callback nutzt den server-only Autotask-Client.
export const runtime = "nodejs";

export const { GET, POST } = handlers;
