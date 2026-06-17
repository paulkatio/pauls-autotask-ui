import "server-only";

import type { SessionUser } from "@/lib/auth/session";

// Zugriffs-Gate für den Bereich „Vertrieb" (Rechnungen/Verträge/Angebote).
//
// BEWUSSTE AUSNAHME zur sonstigen Regel „alle Nutzer sehen dieselbe Ansicht / kein
// Rollen-Gating" (DECISIONS.md B12, 2026-06-03). Der Vertriebsbereich ist nur für
// wenige Personen sichtbar – gegated über die **Autotask-Resource-ID** der Session
// gegen eine Allowlist aus der Umgebungsvariable `SALES_ALLOWED_RESOURCE_IDS`
// (kommagetrennte IDs). Die echten Prod-IDs werden getrennt/kontrolliert gesetzt
// und nie eingecheckt.
//
// FAIL-CLOSED: leere/fehlende Allowlist ⇒ NIEMAND hat Zugriff (nicht „alle").

function parseAllowlist(): ReadonlySet<number> {
  const raw = process.env.SALES_ALLOWED_RESOURCE_IDS ?? "";
  const ids = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return new Set(ids);
}

// Einmal beim Modul-Load auswerten (Env ändert sich zur Laufzeit nicht).
const ALLOWED = parseAllowlist();

export function canAccessSales(
  session: Pick<SessionUser, "autotaskResourceId"> | null | undefined,
): boolean {
  if (!session) return false;
  if (ALLOWED.size === 0) return false; // fail-closed: leere Allowlist ⇒ niemand
  return ALLOWED.has(session.autotaskResourceId);
}
