import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { getContactsList } from "@/lib/autotask/entities/contact-list";
import { autotaskErrorResponse } from "@/lib/api/error-response";

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
    return autotaskErrorResponse(e);
  }
}
