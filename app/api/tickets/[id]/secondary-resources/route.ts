import { NextResponse } from "next/server";

import { guardApi } from "@/lib/security/api-guard";
import { RL } from "@/lib/security/rate-limit";
import { ticketSecondaryResources } from "@/lib/autotask/entities/ticket-secondary-resources";
import { autotaskErrorResponse } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";

// Zusätzlichen Mitarbeiter (Secondary Resource) zu einem Ticket hinzufügen.
// Body: { resourceID, roleID } – beide Pflicht (Autotask verlangt die Rolle).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guardApi(req, { rateLimit: RL.write });
  if (!g.ok) return g.res;
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
    return autotaskErrorResponse(e);
  }
}
