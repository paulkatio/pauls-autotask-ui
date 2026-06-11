import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { ticketSecondaryResources } from "@/lib/autotask/entities/ticket-secondary-resources";
import { AutotaskError } from "@/lib/autotask/client";

export const dynamic = "force-dynamic";

// Zusätzlichen Mitarbeiter (Secondary Resource) zu einem Ticket hinzufügen.
// Body: { resourceID, roleID } – beide Pflicht (Autotask verlangt die Rolle).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const { id } = await params;
  const ticketId = Number(id);
  if (!Number.isFinite(ticketId)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as {
    resourceID?: unknown;
    roleID?: unknown;
  } | null;
  const resourceID = Number(body?.resourceID);
  const roleID = Number(body?.roleID);
  if (!Number.isFinite(resourceID) || !Number.isFinite(roleID)) {
    return NextResponse.json(
      { error: "resourceID und roleID erforderlich." },
      { status: 400 },
    );
  }

  try {
    const itemId = await ticketSecondaryResources.add(ticketId, resourceID, roleID);
    return NextResponse.json({ ok: true, itemId });
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
