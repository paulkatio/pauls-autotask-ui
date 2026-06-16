import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { resources } from "@/lib/autotask/entities/resources";
import { autotaskErrorResponse } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";

// Aktive interne Mitarbeiter (licenseType 1) für die Zuweisungs-Auswahl beim
// Anlegen eines neuen Tickets. Lazy geladen, sobald der Dialog die Liste braucht.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  try {
    const list = await resources.listActive();
    return NextResponse.json({ resources: list });
  } catch (e) {
    return autotaskErrorResponse(e);
  }
}
