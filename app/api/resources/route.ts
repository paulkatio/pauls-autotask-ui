import { NextResponse } from "next/server";

import { guardApi } from "@/lib/security/api-guard";
import { RL } from "@/lib/security/rate-limit";
import { resources } from "@/lib/autotask/entities/resources";
import { autotaskErrorResponse } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";

// Aktive interne Mitarbeiter (licenseType 1) für die Zuweisungs-Auswahl beim
// Anlegen eines neuen Tickets. Lazy geladen, sobald der Dialog die Liste braucht.
export async function GET(req: Request) {
  const g = await guardApi(req, { rateLimit: RL.read });
  if (!g.ok) return g.res;
  try {
    const list = await resources.listActive();
    return NextResponse.json({ resources: list });
  } catch (e) {
    return autotaskErrorResponse(e);
  }
}
