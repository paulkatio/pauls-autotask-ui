import "server-only";

import { redirect } from "next/navigation";

import type { AuthProvider } from "@/lib/auth/provider";
import type { SessionUser } from "@/lib/auth/session";
import { mockProvider } from "@/lib/auth/mock-provider";
import { entraProvider } from "@/lib/auth/entra-provider";

// Provider-Auswahl ausschließlich über AUTH_MODE. Der Umstieg auf Entra ID
// kostet später nur diese eine Umgebungsvariable (siehe CLAUDE.md §4).
//
// FAIL-CLOSED: In Produktion MUSS AUTH_MODE exakt "entra" sein. Jeder andere Wert
// (fehlend, Tippfehler) darf NICHT still auf den passwortlosen Mock-Login
// zurückfallen – das wäre gegen die echten Prod-Daten ein offenes Scheunentor
// (Sicherheits-Audit Cutover). Lieber harter Fehler als unsichere Anmeldung.
const IS_PROD = process.env.NODE_ENV === "production";
// Während `next build` (Prerender/Export) sind Runtime-Env-Vars wie AUTH_MODE oft
// nicht gesetzt (z. B. im Docker-Build ohne .env). Der fail-closed-Riegel darf dann
// NICHT greifen, sonst bricht der Build. Er gilt nur zur LAUFZEIT.
const IS_BUILD_PHASE = process.env.NEXT_PHASE === "phase-production-build";

export function getAuthProvider(): AuthProvider {
  const mode = process.env.AUTH_MODE;
  if (mode === "entra") return entraProvider;
  // Explizites `mock` ist eine bewusste Wahl (auch im Container) → erlaubt.
  if (mode === "mock") return mockProvider;
  // Unbestimmt/vertippt: in Produktion NICHT still auf Mock zurückfallen (das wäre ein
  // passwortloses Login gegen echte Daten) → harter Fehler. Ausnahme: `next build`,
  // wo Runtime-Env-Vars fehlen dürfen (sonst bricht z. B. der Docker-Build).
  if (IS_PROD && !IS_BUILD_PHASE) {
    throw new Error(
      "AUTH_MODE muss in Produktion explizit 'entra' oder 'mock' sein – kein stiller Fallback.",
    );
  }
  return mockProvider;
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
