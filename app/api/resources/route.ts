import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { resources } from "@/lib/autotask/entities/resources";
import { AutotaskError } from "@/lib/autotask/client";

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
