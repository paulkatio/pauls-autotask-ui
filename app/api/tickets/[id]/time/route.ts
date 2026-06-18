import { NextResponse } from "next/server";

import { guardApi } from "@/lib/security/api-guard";
import { RL } from "@/lib/security/rate-limit";
import { timeEntries } from "@/lib/autotask/entities/time-entries";
import { tickets } from "@/lib/autotask/entities/tickets";
import { getTicketPicklists } from "@/lib/autotask/entities/picklists";
import { autotaskErrorResponse } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";

// GET: Tätigkeitsarten (Work Types) + Status-Picklist + aktueller Ticket-Status
// für den Dialog (optionaler Status-Wechsel beim Zeiterfassen). Die Rolle wird
// NICHT im UI gewählt – sie wird beim POST server-seitig gesetzt.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guardApi(req, { rateLimit: RL.read });
  if (!g.ok) return g.res;
  const { id } = await params;
  const ticketId = Number(id);
  if (!Number.isFinite(ticketId)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }
  try {
    const [workTypes, picklists, ticket] = await Promise.all([
      timeEntries.workTypes(),
      getTicketPicklists(),
      tickets.get(ticketId),
    ]);
    return NextResponse.json({
      workTypes,
      statuses: picklists.status,
      currentStatus: ticket?.status ?? null,
    });
  } catch (e) {
    return autotaskErrorResponse(e);
  }
}

// POST: Zeiteintrag anlegen. resourceID kommt aus der Session (nicht vom Client).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guardApi(req, { rateLimit: RL.write });
  if (!g.ok) return g.res;
  const session = g.session;
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
    return autotaskErrorResponse(e);
  }
}
