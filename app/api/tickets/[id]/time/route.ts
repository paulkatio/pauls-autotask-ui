import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { timeEntries } from "@/lib/autotask/entities/time-entries";
import { tickets } from "@/lib/autotask/entities/tickets";
import { AutotaskError } from "@/lib/autotask/client";

export const dynamic = "force-dynamic";

function autotaskError(e: unknown) {
  if (e instanceof AutotaskError) {
    const rateLimited = e.status === 429;
    return NextResponse.json(
      {
        error: rateLimited
          ? "Rate-Limit erreicht (429). Bitte kurz warten."
          : e.message,
        rateLimited,
      },
      { status: rateLimited ? 429 : 502 },
    );
  }
  return NextResponse.json({ error: "Unerwarteter Fehler" }, { status: 500 });
}

// GET: Tätigkeitsarten (Work Types) für die Auswahl im Dialog. Die Rolle wird
// NICHT mehr im UI gewählt (immer dieselbe) – sie wird beim POST server-seitig
// gesetzt.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  try {
    const workTypes = await timeEntries.workTypes();
    return NextResponse.json({ workTypes });
  } catch (e) {
    return autotaskError(e);
  }
}

// POST: Zeiteintrag anlegen. resourceID kommt aus der Session (nicht vom Client).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const { id } = await params;
  const ticketId = Number(id);
  if (!Number.isFinite(ticketId)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as {
    date?: unknown;
    from?: unknown;
    to?: unknown;
    billingCodeId?: unknown;
    summaryNotes?: unknown;
    appendToResolution?: unknown;
  } | null;

  const date = typeof body?.date === "string" ? body.date : "";
  const from = typeof body?.from === "string" ? body.from : "";
  const to = typeof body?.to === "string" ? body.to : "";
  const billingCodeId = Number(body?.billingCodeId);
  const appendToResolution = body?.appendToResolution === true;
  const summaryNotes =
    typeof body?.summaryNotes === "string" ? body.summaryNotes.trim() : "";

  if (!date || !from || !to) {
    return NextResponse.json(
      { error: "Datum, Von- und Bis-Uhrzeit sind erforderlich." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(billingCodeId)) {
    return NextResponse.json(
      { error: "Tätigkeitsart ist erforderlich." },
      { status: 400 },
    );
  }

  const start = new Date(`${date}T${from}:00`);
  const end = new Date(`${date}T${to}:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "Ungültige Zeitangabe." }, { status: 400 });
  }
  const hoursWorked = (end.getTime() - start.getTime()) / 3_600_000;
  if (hoursWorked <= 0) {
    return NextResponse.json(
      { error: "Die Bis-Uhrzeit muss nach der Von-Uhrzeit liegen." },
      { status: 400 },
    );
  }

  try {
    // Rolle server-seitig setzen (nicht im UI gewählt): erste aktive Rolle des
    // Users. roleID ist bei Ticket-Zeiten Pflicht (DECISIONS V3).
    const roles = await timeEntries.rolesForResource(session.autotaskResourceId);
    if (roles.length === 0) {
      return NextResponse.json(
        { error: "Für diesen Benutzer ist keine Rolle hinterlegt." },
        { status: 400 },
      );
    }
    const itemId = await timeEntries.create(ticketId, {
      resourceId: session.autotaskResourceId,
      roleId: roles[0].roleID,
      billingCodeId,
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
      hoursWorked: Math.round(hoursWorked * 100) / 100,
      summaryNotes,
    });

    // Optional: Zusammenfassung an das Lösungsfeld des Tickets anhängen.
    if (appendToResolution && summaryNotes) {
      await tickets.appendResolution(ticketId, summaryNotes);
    }
    return NextResponse.json({ itemId });
  } catch (e) {
    return autotaskError(e);
  }
}
