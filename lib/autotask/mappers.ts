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

// Token-Klasse für den Statuspunkt (wie Autotask), aber über semantische Tokens –
// passt sich Hell/Dunkel automatisch an (KEIN fixes Hex mehr). Grob an den Autotask-
// Status-Farben orientiert; die vielen Warte-/System-Status neutral.
export function statusDotClass(id: number | null | undefined): string {
  switch (id) {
    case 1: // Neu
      return "bg-warning"; // amber/ocker
    case 11: // Eskaliert
    case 21: // Reklamation
      return "bg-destructive"; // rot (einziger lauter Punkt)
    case 13: // Warten auf Genehmigung
    case 19: // Spätere Fälligkeit
      return "bg-chart-2"; // gedämpftes Stahlblau
    case 22: // Genehmigung erteilt
    case 5: // Abgeschlossen
    case 14: // Gelöst warten auf Kunden
      return "bg-success"; // grün
    case 23: // Genehmigung abgelehnt
      return "bg-warning"; // amber (abgelehnt ≠ Fehler)
    default:
      // In Bearbeitung, Servicetermin, Fälligkeit überschritten, Warte-/System-Status …
      return "bg-muted-foreground"; // neutral
  }
}

// Projekt-Status (IDs verifiziert 2026-06-12). Eigene Picklist, KEIN Eskalations-
// zustand → kein lautes Rot. Drei ruhige Stufen (warm-achromatisch):
//  default (schwarz) = „In Bearbeitung" (aktiver Fokus, dezent betont)
//  secondary (grau)  = erledigt/ruhend (Abgeschlossen, Inaktiv)
//  outline           = alle übrigen (Neu, Pausiert, Projektänderung, Warte-Status)
export function projectStatusVariant(id: number | null | undefined): BadgeVariant {
  switch (id) {
    case 2: // In Bearbeitung
      return "default";
    case 5: // Abgeschlossen
    case 0: // Inaktiv
      return "secondary";
    default:
      return "outline";
  }
}

// --- Vertrieb: Rechnungen ---------------------------------------------------
// Autotask `Invoices` hat KEINEN Zahlstatus-Picklist. Der für die UI nützliche
// Status wird abgeleitet (DECISIONS.md 2026-06-17): isVoided -> Storniert;
// paidDate gesetzt -> Bezahlt; sonst dueDate < jetzt -> Überfällig; sonst Offen.
export type InvoiceUiStatus = "storniert" | "bezahlt" | "ueberfaellig" | "offen";

export function deriveInvoiceStatus(
  inv: {
    isVoided?: boolean | null;
    paidDate?: string | null;
    dueDate?: string | null;
  },
  nowMs: number,
): InvoiceUiStatus {
  if (inv.isVoided) return "storniert";
  if (inv.paidDate) return "bezahlt";
  if (inv.dueDate) {
    const due = new Date(inv.dueDate).getTime();
    if (Number.isFinite(due) && due < nowMs) return "ueberfaellig";
  }
  return "offen";
}

export function invoiceStatusLabel(s: InvoiceUiStatus): string {
  switch (s) {
    case "storniert":
      return "Storniert";
    case "bezahlt":
      return "Bezahlt";
    case "ueberfaellig":
      return "Überfällig";
    case "offen":
      return "Offen";
  }
}

export function invoiceStatusVariant(s: InvoiceUiStatus): BadgeVariant {
  switch (s) {
    case "bezahlt":
      return "success";
    case "ueberfaellig":
      return "destructive"; // einziger lauter Zustand
    case "offen":
      return "outline";
    case "storniert":
      return "secondary";
  }
}

// --- Vertrieb: Angebote -----------------------------------------------------
// Quotes.approvalStatus (verifiziert 2026-06-17): 1=Nicht angefordert,
// 2=Warten auf Genehmigung, 3=Genehmigt, 4=Abgelehnt.
export function quoteStatusVariant(id: number | null | undefined): BadgeVariant {
  switch (id) {
    case 3: // Genehmigt
      return "success";
    case 4: // Abgelehnt
      return "destructive";
    case 2: // Warten auf Genehmigung
      return "outline";
    case 1: // Nicht angefordert
    default:
      return "secondary";
  }
}

export function quoteStatusLabel(id: number | null | undefined): string {
  switch (id) {
    case 1:
      return "Nicht angefordert";
    case 2:
      return "Warten auf Genehmigung";
    case 3:
      return "Genehmigt";
    case 4:
      return "Abgelehnt";
    default:
      return "—";
  }
}

// Zahlungsziel (paymentTerm) – Picklist identisch bei Invoices & Quotes
// (verifiziert 2026-06-17).
const PAYMENT_TERMS: Record<number, string> = {
  1: "30 Tage netto",
  2: "45 Tage netto",
  3: "60 Tage netto",
  4: "Fällig bei Erhalt",
  5: "15 Tage 2% Skonto",
  6: "7 Tage 3% Skonto, 30 Tage netto",
  7: "7 Tage 3% Skonto, 60 Tage netto",
  8: "10 Tage 4% Skonto, 30 Tage netto",
  9: "7 Tage 5% Skonto, 60 Tage netto",
  10: "SEPA-Lastschrift",
  11: "7 Tage netto",
};
export function paymentTermLabel(id: number | null | undefined): string {
  return id != null ? (PAYMENT_TERMS[id] ?? String(id)) : "—";
}

// --- Vertrieb: Verträge -----------------------------------------------------
// Contracts.status (verifiziert 2026-06-17): 0=Inactive, 1=Active.
export function contractStatusVariant(id: number | null | undefined): BadgeVariant {
  return id === 1 ? "success" : "secondary";
}

export function contractStatusLabel(id: number | null | undefined): string {
  return id === 1 ? "Aktiv" : id === 0 ? "Inaktiv" : "—";
}

// Contracts.contractType / contractCategory (verifiziert 2026-06-17).
const CONTRACT_TYPES: Record<number, string> = {
  1: "Individual",
  3: "Pauschal",
  4: "Stundenkontingent",
  6: "Vorauszahlung",
  7: "Service",
  8: "Ticket",
  9: "Rahmen",
};
export function contractTypeLabel(id: number | null | undefined): string {
  return id != null ? (CONTRACT_TYPES[id] ?? String(id)) : "—";
}

const CONTRACT_CATEGORIES: Record<number, string> = {
  11: "Serviceverträge – Gold",
  14: "Serviceverträge – Silber",
  15: "Serviceverträge – Bronze",
  16: "WaaS Client",
};
export function contractCategoryLabel(id: number | null | undefined): string {
  return id != null ? (CONTRACT_CATEGORIES[id] ?? String(id)) : "—";
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
