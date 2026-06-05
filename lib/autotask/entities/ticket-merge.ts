import "server-only";

import { autotask } from "@/lib/autotask/client";
import { ticketNotes } from "@/lib/autotask/entities/ticket-notes";

// Ticket-Zusammenführung (B26) — bildet das NATIVE Autotask-Merge nach, weil die REST-
// API kein Merge kennt (kein Endpoint/keine Funktion; recherchiert 2026-06-05: Datto-PSA-
// Doku „Merging tickets" + GitHub ecitsolutions/Autotask#56). Autotask-Verhalten, das
// wir 1:1 nachbilden:
//   - Quell-/„merged"-Tickets  → Status ABGESCHLOSSEN (5); bleiben im System.
//   - Ziel-/„absorber"-Ticket  → Status UNVERÄNDERT.
//   - Beidseitige interne System-Notizen; die Beschreibung der Quelle landet im Ziel.
// Umsetzung: ticketNotes.createInternal (noteType 2/publish 1, kundenunsichtbar) +
// Status-Update der Quellen. Zeit-/Anhang-Reparenting ist per API nicht möglich → die
// bleiben am (abgeschlossenen) Quellticket. Nur bestehende, verifizierte Schreibpfade.

const STATUS_COMPLETE = 5;
const MERGE_FIELDS = [
  "id",
  "ticketNumber",
  "companyID",
  "title",
  "description",
  "status",
];

interface MergeTicket {
  id: number;
  ticketNumber?: string | null;
  companyID?: number | null;
  title?: string | null;
  description?: string | null;
  status?: number;
}

export interface MergeSourceResult {
  id: number;
  ticketNumber: string;
  ok: boolean;
  error?: string;
}

export interface MergeResult {
  targetTicketNumber: string;
  targetNoteCreated: boolean;
  sources: MergeSourceResult[];
}

const num = (t: MergeTicket) => t.ticketNumber ?? String(t.id);

export async function mergeTickets(
  targetId: number,
  sourceIds: number[],
): Promise<MergeResult> {
  const uniqueSources = [...new Set(sourceIds)].filter((id) => id !== targetId);
  if (uniqueSources.length === 0) {
    throw new Error("Mindestens ein Quellticket (≠ Ziel) nötig.");
  }

  const rows = await autotask.query<MergeTicket>(
    "Tickets",
    {
      MaxRecords: 200,
      IncludeFields: MERGE_FIELDS,
      Filter: [{ op: "in", field: "id", value: [targetId, ...uniqueSources] }],
    },
    { autoPage: false },
  );
  const byId = new Map(rows.map((t) => [t.id, t]));
  const target = byId.get(targetId);
  if (!target) throw new Error("Ziel-Ticket nicht gefunden.");
  const sources = uniqueSources
    .map((id) => byId.get(id))
    .filter((t): t is MergeTicket => t != null);
  if (sources.length === 0) throw new Error("Keine Quelltickets gefunden.");

  // Guard (server-seitig erzwungen): nur innerhalb derselben Firma.
  if (target.companyID == null || sources.some((s) => s.companyID !== target.companyID)) {
    throw new Error("Zusammenführen nur innerhalb derselben Firma möglich.");
  }

  // Ziel-Notiz: Titel + Beschreibung jeder Quelle übernehmen (Dubletten-Inhalt im Master).
  const targetBody =
    "Folgende Tickets wurden in dieses Ticket zusammengeführt:\n\n" +
    sources
      .map((s) => {
        const desc = (s.description ?? "").trim();
        return `── ${num(s)}: ${s.title ?? "(ohne Titel)"}${desc ? `\n${desc}` : ""}`;
      })
      .join("\n\n");
  let targetNoteCreated = false;
  try {
    await ticketNotes.createInternal(targetId, {
      title: `Zusammengeführt aus ${sources.length} Ticket(s)`,
      description: targetBody,
    });
    targetNoteCreated = true;
  } catch {
    targetNoteCreated = false;
  }

  // Quellen sequenziell: Verlinkungsnotiz + Status -> Abgeschlossen. Teilfehler erfasst.
  const results: MergeSourceResult[] = [];
  for (const s of sources) {
    try {
      await ticketNotes.createInternal(s.id, {
        title: "Zusammengeführt",
        description: `Dieses Ticket wurde abgeschlossen und in ${num(target)} zusammengeführt. Zeiteinträge und Anhänge verbleiben hier.`,
      });
      await autotask.update("Tickets", { id: s.id, status: STATUS_COMPLETE });
      results.push({ id: s.id, ticketNumber: num(s), ok: true });
    } catch (e) {
      results.push({
        id: s.id,
        ticketNumber: num(s),
        ok: false,
        error: e instanceof Error ? e.message : "Fehler.",
      });
    }
  }

  return { targetTicketNumber: num(target), targetNoteCreated, sources: results };
}
