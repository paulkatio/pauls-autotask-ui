import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import {
  mergeTickets,
  MergeValidationError,
} from "@/lib/autotask/entities/ticket-merge";
import { autotaskErrorResponse } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";

// Obergrenze pro Merge: schützt vor versehentlichem Massen-Abschluss (jedes
// Quellticket wird auf „abgeschlossen" gesetzt + bekommt eine NICHT löschbare
// Notiz → irreversibel). Bewusst klein gehalten (Sicherheits-Audit).
const MAX_MERGE_SOURCES = 10;

// POST /api/tickets/merge — mehrere Tickets „Link & Close" in ein Ziel zusammenführen.
// Body: { targetId: number, sourceIds: number[] }. Firmen-Guard server-seitig in
// mergeTickets erzwungen. KEIN Reparenting (API kann das nicht).
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    targetId?: unknown;
    sourceIds?: unknown;
  } | null;

  const targetId = Number(body?.targetId);
  const sourceIds = Array.isArray(body?.sourceIds)
    ? body!.sourceIds.map(Number).filter((n) => Number.isFinite(n))
    : [];

  if (!Number.isFinite(targetId) || sourceIds.length === 0) {
    return NextResponse.json(
      { error: "Ziel-Ticket und mindestens ein Quellticket nötig." },
      { status: 400 },
    );
  }
  if (sourceIds.includes(targetId)) {
    return NextResponse.json(
      { error: "Das Ziel-Ticket darf nicht unter den Quelltickets sein." },
      { status: 400 },
    );
  }
  if (sourceIds.length > MAX_MERGE_SOURCES) {
    return NextResponse.json(
      {
        error: `Maximal ${MAX_MERGE_SOURCES} Quelltickets pro Zusammenführung (${sourceIds.length} angefragt).`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await mergeTickets(targetId, sourceIds, session.displayName);
    return NextResponse.json(result);
  } catch (e) {
    // Fachliche Validierung (z. B. Firmen-Guard) → verständlicher 400 vor jedem
    // Schreibpfad. Alles andere zentral (AutotaskError kuratiert, Rest generisch).
    if (e instanceof MergeValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return autotaskErrorResponse(e);
  }
}
