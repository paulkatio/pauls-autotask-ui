import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { contacts } from "@/lib/autotask/entities/contacts";
import { AutotaskError } from "@/lib/autotask/client";

export const dynamic = "force-dynamic";

// Aktive Kontakte einer Firma (für die Kontakt-Auswahl beim Anlegen eines neuen
// Tickets, nachdem die Firma gewählt wurde). Liefert RefOption[] (id + label).
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const companyId = Number(new URL(req.url).searchParams.get("companyId"));
  if (!Number.isFinite(companyId)) {
    return NextResponse.json({ error: "Ungültige companyId" }, { status: 400 });
  }
  try {
    const list = await contacts.byCompany(companyId);
    return NextResponse.json({ contacts: list });
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
