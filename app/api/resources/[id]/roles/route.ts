import { NextResponse } from "next/server";

import { guardApi } from "@/lib/security/api-guard";
import { RL } from "@/lib/security/rate-limit";
import { timeEntries } from "@/lib/autotask/entities/time-entries";
import { autotaskErrorResponse } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";

// Rollen einer Resource (für die gekoppelte Zuweisung: assignedResourceID +
// assignedResourceRoleID müssen zusammen gesetzt werden).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guardApi(req, { rateLimit: RL.read });
  if (!g.ok) return g.res;
  const { id } = await params;
  const resourceId = Number(id);
  if (!Number.isFinite(resourceId)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }
  try {
    const roles = await timeEntries.rolesForResource(resourceId);
    return NextResponse.json({ roles });
  } catch (e) {
    return autotaskErrorResponse(e);
  }
}
