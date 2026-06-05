import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { getTicketDetail } from "@/lib/autotask/entities/ticket-detail";
import { autotask, AutotaskError } from "@/lib/autotask/client";

export const dynamic = "force-dynamic";

// Inline-editierbare Felder (B15b). Werte sind Picklist-/Referenz-IDs oder null.
const EDITABLE_FIELDS = [
  "status",
  "priority",
  "queueID",
  "issueType",
  "subIssueType",
  "assignedResourceID",
  "assignedResourceRoleID",
  "companyID",
  "contactID",
  "configurationItemID",
  "contractID",
  "companyLocationID",
] as const;

// Editierbare Textfelder (String).
const STRING_FIELDS = ["description"] as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const { id } = await params;
  const num = Number(id);
  if (!Number.isFinite(num)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }
  try {
    const detail = await getTicketDetail(num);
    if (!detail) {
      return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json(detail);
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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const { id } = await params;
  const num = Number(id);
  if (!Number.isFinite(num)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json({ error: "Ungültiger Body" }, { status: 400 });
  }

  // Nur erlaubte Felder übernehmen; Werte = Zahl oder null.
  const data: Record<string, number | string | null> = {};
  for (const key of EDITABLE_FIELDS) {
    if (!(key in body)) continue;
    const v = body[key];
    if (v === null) {
      data[key] = null;
    } else {
      const n = Number(v);
      if (!Number.isFinite(n)) {
        return NextResponse.json(
          { error: `Ungültiger Wert für ${key}.` },
          { status: 400 },
        );
      }
      data[key] = n;
    }
  }

  // Textfelder (String) – z. B. Beschreibung. Separat behandelt, da nicht numerisch.
  for (const key of STRING_FIELDS) {
    if (!(key in body)) continue;
    const v = body[key];
    if (typeof v !== "string") {
      return NextResponse.json(
        { error: `Ungültiger Wert für ${key}.` },
        { status: 400 },
      );
    }
    data[key] = v;
  }

  // Zuweisung: Resource und Rolle müssen ZUSAMMEN gesetzt (oder beide null) werden.
  const hasRes = "assignedResourceID" in data;
  const hasRole = "assignedResourceRoleID" in data;
  if (hasRes !== hasRole) {
    return NextResponse.json(
      { error: "Zuweisung erfordert Resource und Rolle zusammen." },
      { status: 400 },
    );
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Keine Änderung." }, { status: 400 });
  }

  try {
    await autotask.update("Tickets", { id: num, ...data });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AutotaskError) {
      const rateLimited = e.status === 429;
      return NextResponse.json(
        { error: rateLimited ? "Rate-Limit erreicht (429)." : e.message, rateLimited },
        { status: rateLimited ? 429 : 502 },
      );
    }
    return NextResponse.json({ error: "Unerwarteter Fehler" }, { status: 500 });
  }
}
