import { type AutotaskFilter } from "@/lib/autotask/client";

// Jahres-Zeitfenster für den Vertriebsbereich (Rechnungen/Angebote/Verträge).
// BEWUSST ohne "server-only": `yearOptions`/`normalizeYear` werden auch im Client
// (VertriebPeriodSelect) gebraucht; der `AutotaskFilter`-Import ist rein typweise
// (zur Laufzeit gelöscht) -> kein server-only-Code im Client-Bundle.
//
// Anders als `lib/autotask/ticket-window.ts` (das "seit X" filtert) ist das hier
// GENAU EIN Kalenderjahr: untere Grenze (1. Jan, inklusiv) UND obere Grenze
// (1. Jan Folgejahr, exklusiv). Auswahl "alle" -> kein Filter.

export interface YearWindow {
  startISO: string; // inklusiv: 1. Januar des Jahres
  endISO: string; // exklusiv: 1. Januar des Folgejahres
}

// Aktuelles Jahr + 3 Vorjahre = 4 Jahre in der Liste.
const YEARS_BACK = 3;

// Dynamische Optionsliste: [aktuelles Jahr … nowYear-3] + "Alle".
export function yearOptions(nowYear: number): { value: string; label: string }[] {
  const years: { value: string; label: string }[] = [];
  for (let y = nowYear; y >= nowYear - YEARS_BACK; y--) {
    years.push({ value: String(y), label: String(y) });
  }
  return [...years, { value: "alle", label: "Alle" }];
}

// Normalisiert ?zeitraum= auf "alle" oder eine Jahreszahl-String; sonst Default =
// aktuelles Jahr. Bewusst KEINE Bereichsprüfung (auch ältere ?zeitraum=2019 ok).
export function normalizeYear(v: string | undefined, nowYear: number): string {
  if (v === "alle") return "alle";
  if (v && /^\d{4}$/.test(v)) return v;
  return String(nowYear);
}

// Fenster zu einem normalisierten Wert. "alle" (bzw. alles außer JJJJ) -> null.
export function yearWindowOf(value: string): YearWindow | null {
  if (!/^\d{4}$/.test(value)) return null;
  const y = Number(value);
  return {
    startISO: `${y}-01-01T00:00:00`,
    endISO: `${y + 1}-01-01T00:00:00`,
  };
}

// gte+lt Filter auf das übergebene Datumsfeld. null -> ungefiltert (`gte id 0`,
// wie bisher der "alle"-Fall in den Entities).
export function yearWindowFilter(
  win: YearWindow | null,
  field: string,
): AutotaskFilter[] {
  return win
    ? [
        { op: "gte", field, value: win.startISO },
        { op: "lt", field, value: win.endISO },
      ]
    : [{ op: "gte", field: "id", value: 0 }];
}
