import "server-only";

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth/session";
import { csrfResponse } from "@/lib/security/origin";
import {
  enforceRateLimit,
  clientIp,
  type RateLimitOptions,
} from "@/lib/security/rate-limit";

// Zentrale Eingangskontrolle für API-Route-Handler. Bündelt die drei Riegel, die
// sonst in jeder Route einzeln (und damit fehleranfällig) stehen würden:
//   1) CSRF: bei zustandsändernden Methoden (POST/PATCH/PUT/DELETE) den Origin prüfen.
//   2) AuthN: gültige Session erzwingen (sonst 401).
//   3) Rate-Limit: pro Session-Identität (optional, je Eimer).
//
// Verwendung:
//   const g = await guardApi(req, { rateLimit: RL.write });
//   if (!g.ok) return g.res;
//   const session = g.session;

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type GuardResult =
  | { ok: true; session: SessionUser }
  | { ok: false; res: NextResponse };

export async function guardApi(
  req: Request,
  opts: { rateLimit?: RateLimitOptions; requireCsrf?: boolean } = {},
): Promise<GuardResult> {
  // 1) CSRF – für schreibende Methoden (oder erzwungen).
  if (opts.requireCsrf || MUTATING.has(req.method.toUpperCase())) {
    const bad = csrfResponse(req);
    if (bad) return { ok: false, res: bad };
  }

  // 2) Session.
  const session = await getSession();
  if (!session) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 }),
    };
  }

  // 3) Rate-Limit pro Identität (Session-ID; IP nur als Notnagel).
  if (opts.rateLimit) {
    const identity = session.id || clientIp(req);
    const limited = await enforceRateLimit(identity, opts.rateLimit);
    if (limited) return { ok: false, res: limited };
  }

  return { ok: true, session };
}
