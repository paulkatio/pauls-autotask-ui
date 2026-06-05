// Reine Präsentations-Formatierung (client- und serverseitig nutzbar).

// Geleistete Zeit als kompakte deutsche Dauer "H:MM Std" (z. B. 2.9167 -> "2:55 Std").
// Der gespeicherte/gesendete Dezimalwert bleibt unberührt – nur die Anzeige.
export function formatHours(hours: number | null | undefined): string {
  if (hours == null || !Number.isFinite(hours)) return "—";
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")} Std`;
}
