import "server-only";

import { redirect } from "next/navigation";

import type { AuthProvider } from "@/lib/auth/provider";
import type { SessionUser } from "@/lib/auth/session";
import { mockProvider } from "@/lib/auth/mock-provider";
import { entraProvider } from "@/lib/auth/entra-provider";

// Provider-Auswahl ausschließlich über AUTH_MODE. Der Umstieg auf Entra ID
// kostet später nur diese eine Umgebungsvariable (siehe CLAUDE.md §4).
export function getAuthProvider(): AuthProvider {
  return process.env.AUTH_MODE === "entra" ? entraProvider : mockProvider;
}

export function getSession(): Promise<SessionUser | null> {
  return getAuthProvider().getSession();
}

export const authMode = (): "mock" | "entra" =>
  process.env.AUTH_MODE === "entra" ? "entra" : "mock";

// Erzwingt eine nutzbare Session oder leitet sauber um:
// - keine Session + Entra-Modus + trotzdem bei Entra angemeldet (keine Autotask-
//   Resource) -> /no-access (eigene Seite, NICHT halbe Session).
// - sonst -> /login.
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (session) return session;

  if (authMode() === "entra") {
    const { auth } = await import("@/lib/auth/authjs");
    const entra = await auth();
    if (entra?.user) redirect("/no-access");
  }
  redirect("/login");
}

export type { SessionUser } from "@/lib/auth/session";
export type { Role } from "@/lib/auth/session";
