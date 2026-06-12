// Globaler Aktions-Verlauf mit Undo (clientseitig, in localStorage). Jede mutierende
// Aktion kann sich hier eintragen. Reversible Aktionen (Feldänderungen) tragen die
// Rücksetz-Operationen mit; nicht-reversible (Notizen, Mails, Merge …) sind reine
// Log-Einträge. Bewusst clientseitig + simpel: kein Server-State nötig, der Verlauf
// ist pro Browser/Gerät.

export interface HistoryReverse {
  id: number;
  // Anzeigename des Datensatzes für Fehlermeldungen (Ticketnummer, Projektname …).
  // Bestandseinträge nutzen `ticketNumber`; neue Einträge `label`. Beide optional,
  // damit `ticket-history-v1` ohne Migration weiterläuft.
  ticketNumber?: string;
  label?: string;
  // API-Pfad für das Re-PATCH der Alt-Werte. Fehlt er (Bestandseinträge), wird
  // `/api/tickets/{id}` angenommen – Tickets bleiben so abwärtskompatibel.
  apiPath?: string;
  // Felder, die zum Zurücksetzen erneut per PATCH gesendet werden (Alt-Werte).
  body: Record<string, number | string | null>;
}

export interface HistoryEntry {
  id: string;
  at: number;
  label: string;
  reversible: boolean;
  reverse?: HistoryReverse[];
  undone?: boolean;
}

const KEY = "ticket-history-v1";
const EVENT = "ticket-history-changed";
const CAP = 60;
// Aufbewahrung: Einträge älter als 7 Tage werden nicht mehr angezeigt (Paul:
// „der soll einfach nur für eine Woche gelten"). Beim nächsten Schreiben fallen
// sie auch aus dem Speicher.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function read(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
    const cutoff = Date.now() - MAX_AGE_MS;
    return list.filter((h) => typeof h.at === "number" && h.at >= cutoff);
  } catch {
    return [];
  }
}

function write(list: HistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, CAP)));
  } catch {
    // localStorage voll / nicht verfügbar -> Verlauf ist best effort.
  }
  window.dispatchEvent(new Event(EVENT));
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000_000)}`;
}

export function getHistory(): HistoryEntry[] {
  return read();
}

export function recordHistory(entry: {
  label: string;
  reversible: boolean;
  reverse?: HistoryReverse[];
}): void {
  const full: HistoryEntry = {
    id: newId(),
    at: Date.now(),
    undone: false,
    ...entry,
  };
  write([full, ...read()]);
}

export function markUndone(id: string): void {
  write(read().map((h) => (h.id === id ? { ...h, undone: true } : h)));
}

export function clearHistory(): void {
  write([]);
}

// Abonniert Verlaufsänderungen (auch tab-übergreifend via storage-Event).
export function subscribeHistory(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
