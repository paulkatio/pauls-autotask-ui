import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { ticketChecklist } from "@/lib/autotask/entities/ticket-checklist";
import { AutotaskError } from "@/lib/autotask/client";

export const dynamic = "force-dynamic";

// Checklisten-Punkt abhaken/enthaken. Schreib-Pfad läuft über den Parent
// (Tickets/{id}/ChecklistItems), Feld isCompleted (verifiziert gegen PROD).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const { id, itemId } = await params;
  const ticketId = Number(id);
  const item = Number(itemId);
  if (!Number.isFinite(ticketId) || !Number.isFinite(item)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as {
    isCompleted?: unknown;
  } | null;
  if (typeof body?.isCompleted !== "boolean") {
    return NextResponse.json(
      { error: "isCompleted (boolean) erforderlich." },
      { status: 400 },
    );
  }

  try {
    await ticketChecklist.setCompleted(ticketId, item, body.isCompleted);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AutotaskError) {
      const rateLimited = e.status === 429;
      return NextResponse.json(
        { error: rateLimited ? "Rate-Limit erreicht (429)." : e.message, rateLimited },
        { status: rateLimited ? 429 : 502 },
      );
    }
    return NextResponse.json({ error: "Unerwarteter Fehler" }, { status: 500 });
  }
}
