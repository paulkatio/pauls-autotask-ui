import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { getContactsList } from "@/lib/autotask/entities/contact-list";
import { AutotaskError } from "@/lib/autotask/client";

export const dynamic = "force-dynamic";

// GET /api/contacts/search?q= — Kontaktsuche (Vor-/Nachname contains) für die
// debounced Suche auf der Kontaktliste (B4). Liefert Zeilen inkl. Firmenname.
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const params = new URL(req.url).searchParams;
  const q = params.get("q") ?? "";
  const rawCompany = params.get("companyId");
  const companyId =
    rawCompany != null && rawCompany !== "" && Number.isFinite(Number(rawCompany))
      ? Number(rawCompany)
      : undefined;
  try {
    const contacts = await getContactsList(q, companyId);
    return NextResponse.json({ contacts });
  } catch (e) {
    if (e instanceof AutotaskError) {
      const rateLimited = e.status === 429;
      return NextResponse.json(
        {
          error: rateLimited ? "Rate-Limit erreicht (429)." : e.message,
          rateLimited,
        },
        { status: rateLimited ? 429 : 502 },
      );
    }
    return NextResponse.json({ error: "Unerwarteter Fehler" }, { status: 500 });
  }
}
