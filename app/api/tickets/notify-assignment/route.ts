import { NextResponse } from "next/server";

import { guardApi } from "@/lib/security/api-guard";
import { RL, enforceRateLimit } from "@/lib/security/rate-limit";
import { notifyAssignment } from "@/lib/tickets/assignment-notify";

export const dynamic = "force-dynamic";

// Versendet die (ggf. gebündelte) Zuweisungs-Mail an die Resource. Wird vom Client
// NACH einem erfolgreichen Assign aufgerufen (Einzel- wie Bulk-Zuweisung). Best
// effort: liefert den Mailstatus zurück, kippt aber nie den Schreibvorgang.
export async function POST(req: Request) {
  const g = await guardApi(req, { rateLimit: RL.email });
  if (!g.ok) return g.res;
  const session = g.session;

  const body = (await req.json().catch(() => null)) as {
    resourceId?: unknown;
    ticketIds?: unknown;
  } | null;

  const resourceId = Number(body?.resourceId);
  const ticketIds = Array.isArray(body?.ticketIds)
    ? body!.ticketIds.map((x) => Number(x)).filter((n) => Number.isFinite(n))
    : [];

  if (!Number.isFinite(resourceId) || ticketIds.length === 0) {
    return NextResponse.json(
      { error: "resourceId und ticketIds erforderlich." },
      { status: 400 },
    );
  }

  // Zweite Schranke pro Empfänger: ein einzelnes Postfach soll auch dann nicht
  // geflutet werden, wenn mehrere Absender zusammenwirken (guardApi limitiert bereits
  // pro Absender via RL.email).
  const recipientLimited = await enforceRateLimit(
    String(resourceId),
    RL.emailRecipient,
  );
  if (recipientLimited) return recipientLimited;

  const result = await notifyAssignment(resourceId, ticketIds, session.displayName);
  return NextResponse.json(result);
}
