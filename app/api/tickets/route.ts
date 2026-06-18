import { NextResponse } from "next/server";

import { guardApi } from "@/lib/security/api-guard";
import { RL } from "@/lib/security/rate-limit";
import { tickets } from "@/lib/autotask/entities/tickets";
import { autotaskErrorResponse } from "@/lib/api/error-response";

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
  const g = await guardApi(req, { rateLimit: RL.write });
  if (!g.ok) return g.res;

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
    return autotaskErrorResponse(e);
  }
}
