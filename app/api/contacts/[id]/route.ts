import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { contacts } from "@/lib/autotask/entities/contacts";
import { companies } from "@/lib/autotask/entities/companies";
import { autotaskErrorResponse } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";

// Kompakte Kontaktdetails für das In-App-Overlay (components/contacts/contact-modal).
// Bewusst schlank (ein Contact + optional Firmenname) – kein Ticketladen.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const id = Number((await params).id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }
  try {
    const c = await contacts.get(id);
    if (!c) {
      return NextResponse.json(
        { error: "Kontakt nicht gefunden" },
        { status: 404 },
      );
    }
    let companyName: string | null = null;
    if (c.companyID != null) {
      try {
        const co = await companies.get(c.companyID);
        companyName = co?.companyName ?? null;
      } catch {
        companyName = null;
      }
    }
    const name =
      `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || `Kontakt ${id}`;
    return NextResponse.json({
      contact: {
        id: c.id,
        name,
        title: c.title ?? null,
        email: c.emailAddress ?? null,
        phone: c.phone ?? null,
        mobilePhone: c.mobilePhone ?? null,
        companyID: c.companyID ?? null,
        companyName,
      },
    });
  } catch (e) {
    return autotaskErrorResponse(e);
  }
}
