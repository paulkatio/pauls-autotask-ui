import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { ticketSecondaryResources } from "@/lib/autotask/entities/ticket-secondary-resources";
import { AutotaskError } from "@/lib/autotask/client";

export const dynamic = "force-dynamic";

// Einen zusätzlichen Mitarbeiter wieder vom Ticket entfernen (per Datensatz-ID).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; srId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const { id, srId } = await params;
  const ticketId = Number(id);
  const secondaryId = Number(srId);
  if (!Number.isFinite(ticketId) || !Number.isFinite(secondaryId)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  try {
    await ticketSecondaryResources.remove(ticketId, secondaryId);
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
