import { NextResponse } from "next/server";

import { guardApi } from "@/lib/security/api-guard";
import { RL } from "@/lib/security/rate-limit";
import { ticketSecondaryResources } from "@/lib/autotask/entities/ticket-secondary-resources";
import { autotaskErrorResponse } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";

// Einen zusätzlichen Mitarbeiter wieder vom Ticket entfernen (per Datensatz-ID).
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; srId: string }> },
) {
  const g = await guardApi(req, { rateLimit: RL.write });
  if (!g.ok) return g.res;
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
    return autotaskErrorResponse(e);
  }
}
