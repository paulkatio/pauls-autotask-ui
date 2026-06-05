import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { timeEntries } from "@/lib/autotask/entities/time-entries";
import { AutotaskError } from "@/lib/autotask/client";

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
    if (e instanceof AutotaskError) {
      const rateLimited = e.status === 429;
      return NextResponse.json(
        { error: `Autotask-Fehler (${e.status})`, rateLimited },
        { status: rateLimited ? 429 : 502 },
      );
    }
    return NextResponse.json({ error: "Unerwarteter Fehler" }, { status: 500 });
  }
}
