import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { mergeTickets } from "@/lib/autotask/entities/ticket-merge";
import { AutotaskError } from "@/lib/autotask/client";

export const dynamic = "force-dynamic";

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

  try {
    const result = await mergeTickets(targetId, sourceIds);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AutotaskError) {
      const rateLimited = e.status === 429;
      return NextResponse.json(
        { error: `Autotask-Fehler (${e.status})`, rateLimited },
        { status: rateLimited ? 429 : 502 },
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unerwarteter Fehler" },
      { status: 400 },
    );
  }
}
