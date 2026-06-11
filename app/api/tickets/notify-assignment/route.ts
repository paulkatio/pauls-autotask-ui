import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { notifyAssignment } from "@/lib/tickets/assignment-notify";

export const dynamic = "force-dynamic";

// Versendet die (ggf. gebündelte) Zuweisungs-Mail an die Resource. Wird vom Client
// NACH einem erfolgreichen Assign aufgerufen (Einzel- wie Bulk-Zuweisung). Best
// effort: liefert den Mailstatus zurück, kippt aber nie den Schreibvorgang.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    resourceId?: unknown;
    ticketIds?: unknown;
  } | null;

  const resourceId = Number(body?.resourceId);
  const ticketIds = Array.isArray(body?.ticketIds)
    ? body!.ticketIds.map((x) => Number(x)).filter((n) => Number.isFinite(n))
    : [];

  if (!Number.isFinite(resourceId) || ticketIds.length === 0) {
    return NextResponse.json(
      { error: "resourceId und ticketIds erforderlich." },
      { status: 400 },
    );
  }

  const result = await notifyAssignment(resourceId, ticketIds, session.displayName);
  return NextResponse.json(result);
}
