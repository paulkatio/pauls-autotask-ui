import type { Picklist } from "@/lib/autotask/types";

// ID -> Label-Mapping für Picklists. Rein funktional (kein server-only nötig),
// damit es auch in Client-Komponenten genutzt werden kann.

export function toLabelMap(list: Picklist): Map<number, string> {
  return new Map(list.map((e) => [e.value, e.label]));
}

export function labelOf(
  list: Picklist,
  id: number | null | undefined,
  fallback = "—",
): string {
  if (id == null) return fallback;
  return list.find((e) => e.value === id)?.label ?? String(id);
}

// Semantische Zuordnung Status/Priorität -> Badge-Varianten. Zusätzlich zu den
// shadcn-Standardvarianten gibt es success (grün) und warning (amber), die über
// eigene OKLCH-Tokens (globals.css) laufen – kein freies bg-green/bg-yellow.
export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning";

// Ticket-Status (IDs verifiziert 2026-06-04). Farbsystem v2 — entschärft:
//  destructive (rot) = Problem (eskaliert/überfällig/Reklamation) — EINZIGER lauter Status
//  outline           = aktiv/informativ (Neu/In Bearbeitung/Servicetermin/Kundennotiz);
//                      Schwarz (default) bleibt den Primär-Aktionen vorbehalten
//  secondary (grau)  = erledigt/wartend/neutral (Abgeschlossen, Warte-Status, sonstiges)
export function statusVariant(id: number | null | undefined): BadgeVariant {
  switch (id) {
    case 11: // Eskaliert
    case 18: // Fälligkeit überschritten
    case 21: // Reklamation
      return "destructive";
    case 1: // Neu
    case 8: // In Bearbeitung
    case 10: // Servicetermin geplant
    case 15: // Kundennotiz hinzugefügt
      return "outline";
    default:
      // Abgeschlossen (5) + Warte-Status (7,9,12,13,14,17,20) + RMM-Warnung
      // geschlossen / Spätere Fälligkeit / unbekannt: gedämpft gefüllt = "erledigt".
      return "secondary";
  }
}

// Farbiger Punkt vor dem Status (wie Autotask). Farben grob an den Autotask-Status-
// Farben orientiert; die vielen Warte-/System-Status neutral (slate). Erste Fassung –
// einzelne Farben bei Bedarf an die echten Autotask-Werte angleichen.
export function statusColor(id: number | null | undefined): string {
  switch (id) {
    case 1: // Neu
      return "#eab308"; // gelb/amber
    case 11: // Eskaliert
    case 21: // Reklamation
      return "#ef4444"; // rot
    case 13: // Warten auf Genehmigung
    case 19: // Spätere Fälligkeit
      return "#3b82f6"; // blau
    case 22: // Genehmigung erteilt
      return "#14b8a6"; // teal
    case 23: // Genehmigung abgelehnt
      return "#f97316"; // orange
    case 5: // Abgeschlossen
    case 14: // Gelöst warten auf Kunden
      return "#22c55e"; // grün
    default:
      // In Bearbeitung, Servicetermin, Fälligkeit überschritten, Warte-/System-Status …
      return "#64748b"; // neutral (slate)
  }
}

// Priorität (Farbsystem v2): Kritisch=rot, Hoch=schwarz (selten+bedeutsam),
// Mittel=grau, Niedrig=outline. Quiet-Scale — nur Kritisch ist "laut".
export function priorityVariant(id: number | null | undefined): BadgeVariant {
  switch (id) {
    case 4: // Kritisch
      return "destructive";
    case 1: // Hoch
      return "default";
    case 2: // Mittel
      return "secondary";
    case 3: // Niedrig
      return "outline";
    default:
      return "secondary"; // unbekannt
  }
}
