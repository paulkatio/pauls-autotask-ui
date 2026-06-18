import { NextResponse } from "next/server";

import { guardApi } from "@/lib/security/api-guard";
import { RL } from "@/lib/security/rate-limit";
import { ticketNotes } from "@/lib/autotask/entities/ticket-notes";
import { autotaskErrorResponse } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";

// POST /api/tickets/[id]/note — interne Notiz im Aktivität-Feed anlegen.
// IMMER intern (noteType 2 / publish 1, in ticketNotes.createInternal fixiert).
// Diese Route setzt NIEMALS das UDF „Kunde benachrichtigen" und nutzt NIE
// noteType 18 – die Notiz darf nie kundensichtbar sein.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guardApi(req, { rateLimit: RL.write });
  if (!g.ok) return g.res;
  const session = g.session;
  const { id } = await params;
  const num = Number(id);
  if (!Number.isFinite(num)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as {
    title?: unknown;
    text?: unknown;
  } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!text) {
    return NextResponse.json(
      { error: "Die Notiz darf nicht leer sein." },
      { status: 400 },
    );
  }

  try {
    const itemId = await ticketNotes.createInternal(num, {
      title: title || undefined,
      description: text,
      authorName: session.displayName,
    });
    return NextResponse.json({ itemId });
  } catch (e) {
    return autotaskErrorResponse(e);
  }
}
