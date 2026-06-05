import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { tickets } from "@/lib/autotask/entities/tickets";
import { AutotaskError } from "@/lib/autotask/client";

export const dynamic = "force-dynamic";

// Numerische Felder, die beim Anlegen übernommen werden (Picklist-/Referenz-IDs).
// Pflicht laut Autotask: companyID, priority, status (title separat als String).
const NUMERIC_FIELDS = [
  "companyID",
  "status",
  "priority",
  "queueID",
  "contactID",
  "issueType",
  "subIssueType",
  "assignedResourceID",
  "assignedResourceRoleID",
] as const;

// POST /api/tickets — neues Ticket anlegen (BFF-Schreibpfad, Whitelist).
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json({ error: "Ungültiger Body" }, { status: 400 });
  }

  // Titel (Pflicht, String, nicht leer).
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json(
      { error: "Titel darf nicht leer sein." },
      { status: 400 },
    );
  }

  const data: Record<string, number | string> = { title };

  // Optionale Beschreibung (String).
  if (typeof body.description === "string" && body.description.trim()) {
    data.description = body.description;
  }

  // Numerische Felder übernehmen (nur endliche Zahlen).
  for (const key of NUMERIC_FIELDS) {
    if (!(key in body) || body[key] == null || body[key] === "") continue;
    const n = Number(body[key]);
    if (!Number.isFinite(n)) {
      return NextResponse.json(
        { error: `Ungültiger Wert für ${key}.` },
        { status: 400 },
      );
    }
    data[key] = n;
  }

  // Pflichtfelder prüfen (Autotask verlangt companyID, status, priority).
  for (const key of ["companyID", "status", "priority"] as const) {
    if (!(key in data)) {
      return NextResponse.json(
        { error: `Pflichtfeld fehlt: ${key}.` },
        { status: 400 },
      );
    }
  }

  // Zuweisung: Resource und Rolle nur zusammen (oder gar nicht).
  const hasRes = "assignedResourceID" in data;
  const hasRole = "assignedResourceRoleID" in data;
  if (hasRes !== hasRole) {
    return NextResponse.json(
      { error: "Zuweisung erfordert Resource und Rolle zusammen." },
      { status: 400 },
    );
  }

  try {
    const itemId = await tickets.create(data);
    return NextResponse.json({ itemId });
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
