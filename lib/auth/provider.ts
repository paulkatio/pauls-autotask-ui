import type { SessionUser } from "@/lib/auth/session";

// Abstraktion über die Auth-Quelle. Mock jetzt, Entra ID später (B16) –
// beide implementieren exakt diese Signatur.
export interface AuthProvider {
  getSession(): Promise<SessionUser | null>;
}
