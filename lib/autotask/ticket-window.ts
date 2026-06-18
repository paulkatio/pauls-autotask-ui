import { type AutotaskFilter } from "@/lib/autotask/client";

// Zeitfenster-Logik für abgeschlossene Tickets. BEWUSST ohne "server-only": diese
// Funktionen sind rein (kein Netz, kein Secret) und werden SOWOHL serverseitig
// (Datenabruf in den Akten-Seiten) ALS AUCH clientseitig (TicketWindowSelect, nur
// TICKET_WINDOW_DEFAULT) gebraucht. Der `AutotaskFilter`-Import ist rein typweise
// (zur Laufzeit gelöscht) -> es gelangt kein server-only-Code ins Client-Bundle.
//
// Hintergrund: Autotask sortiert serverseitig NICHT (DECISIONS B13: `Tickets/query`
// liefert immer id-aufsteigend = älteste zuerst, verifiziert 2026-06-18 in der
// Sandbox). Darum – wie bei Rechnungen/Angeboten – das Fenster per `createDate >=
// Start` serverseitig filtern (Datumsvergleiche WERDEN unterstützt) und im RSC
// absteigend nach createDate sortieren.
export type TicketWindow = "12m" | "24m" | "yearsTwo" | "all";
export const TICKET_WINDOW_DEFAULT: TicketWindow = "24m";

export function normalizeTicketWindow(v: string | undefined): TicketWindow {
  return v === "12m" || v === "24m" || v === "yearsTwo" || v === "all"
    ? v
    : TICKET_WINDOW_DEFAULT;
}

function isoMidnightUTC(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T00:00:00`;
}

// Start-ISO des Fensters relativ zu `nowMs` (vom Aufrufer übergeben, damit kein
// `Date.now()` direkt im Render steckt). `all` -> kein Fenster (null).
export function ticketWindowStartISO(
  win: TicketWindow,
  nowMs: number,
): string | null {
  if (win === "all") return null;
  const now = new Date(nowMs);
  if (win === "yearsTwo") {
    // Dieses + letztes Jahr -> 1. Januar des Vorjahres.
    return `${now.getUTCFullYear() - 1}-01-01T00:00:00`;
  }
  const months = win === "12m" ? 12 : 24;
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return isoMidnightUTC(d);
}

// createDate-Fensterfilter. Leeres Fenster (-> "all") = kein Filter.
export function ticketWindowFilter(startISO: string | null): AutotaskFilter[] {
  return startISO ? [{ op: "gte", field: "createDate", value: startISO }] : [];
}

// Neueste zuerst: absteigend nach createDate (die clientseitige Spaltensortierung
// in der TicketsList bleibt zusätzlich nutzbar).
export function sortByCreatedDesc<T extends { createDate?: string | null }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) =>
    (b.createDate ?? "").localeCompare(a.createDate ?? ""),
  );
}
