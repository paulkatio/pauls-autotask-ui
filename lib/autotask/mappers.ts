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

// Ticket-Status (IDs verifiziert 2026-06-04). Ampel-Logik:
//  rot   = Problem (eskaliert/überfällig/Reklamation)
//  amber = wartet auf etwas
//  primary (indigo) = aktiv in Arbeit
//  grün  = abgeschlossen
//  grau  = neutral/sonstiges
export function statusVariant(id: number | null | undefined): BadgeVariant {
  switch (id) {
    case 11: // Eskaliert
    case 18: // Fälligkeit überschritten
    case 21: // Reklamation
      return "destructive";
    case 5: // Abgeschlossen
      return "success";
    case 1: // Neu
    case 8: // In Bearbeitung
    case 10: // Servicetermin geplant
    case 15: // Kundennotiz hinzugefügt
      return "default";
    case 7: // Warten auf Kundenreaktion
    case 9: // Warten auf Materialien
    case 12: // Warten auf Lieferanten
    case 13: // Warten auf Genehmigung
    case 14: // Gelöst warten auf Kunden
    case 17: // Warten Kundenunterschrift
    case 20: // Warten auf ext. Support
      return "warning";
    default:
      return "secondary"; // RMM-Warnung geschlossen, Spätere Fälligkeit, unbekannt
  }
}

// Priorität als Ampel (Paul-Vorgabe): Niedrig=grün, Mittel=gelb/amber, Hoch=rot,
// Kritisch=rot (stärkste Stufe).
export function priorityVariant(id: number | null | undefined): BadgeVariant {
  switch (id) {
    case 1: // Hoch
    case 4: // Kritisch
      return "destructive";
    case 2: // Mittel
      return "warning";
    case 3: // Niedrig
      return "success";
    default:
      return "secondary"; // unbekannt
  }
}
