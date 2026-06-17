// Reine Präsentations-Formatierung (client- und serverseitig nutzbar).

// Aktuelle Zeit in ms. Bewusst als Modul-Helfer (nicht inline `Date.now()` in einer
// Komponente) – so bleibt die Render-Funktion rein (react-hooks/purity), während die
// (async) Server-Seite die Zeit einmal bestimmt und als Prop weiterreicht.
export function currentMs(): number {
  return Date.now();
}

// Geleistete Zeit als kompakte deutsche Dauer "H:MM Std" (z. B. 2.9167 -> "2:55 Std").
// Der gespeicherte/gesendete Dezimalwert bleibt unberührt – nur die Anzeige.
export function formatHours(hours: number | null | undefined): string {
  if (hours == null || !Number.isFinite(hours)) return "—";
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")} Std`;
}

// Geldbetrag als deutsche Währung (Default EUR – an der Autotask-Rechnung gibt es
// kein Währungsfeld, Tenant = Deutschland, siehe DECISIONS.md 2026-06-17).
const eurFormat = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});
export function formatCurrency(
  value: number | null | undefined,
  currency?: string,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (currency && currency !== "EUR") {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(
      value,
    );
  }
  return eurFormat.format(value);
}

// Datum als deutsches Kurzformat "TT.MM.JJJJ" (z. B. "2026-06-17T…" -> "17.06.2026").
// Akzeptiert ISO-Strings; ungültige/leere Werte -> "—".
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Monats-Schlüssel "JJJJ-MM" (für Gruppierung/Sortierung). Leer bei ungültig.
export function monthKeyOf(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Monats-Beschriftung "Juni 2026" für Gruppen-Überschriften.
export function monthLabelOf(iso: string | null | undefined): string {
  if (!iso) return "Ohne Datum";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Ohne Datum";
  return d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}
