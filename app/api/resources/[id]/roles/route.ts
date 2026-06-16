import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { timeEntries } from "@/lib/autotask/entities/time-entries";
import { autotaskErrorResponse } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";

// Rollen einer Resource (für die gekoppelte Zuweisung: assignedResourceID +
// assignedResourceRoleID müssen zusammen gesetzt werden).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
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
