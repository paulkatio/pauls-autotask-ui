import { NextResponse } from "next/server";

import { guardApi } from "@/lib/security/api-guard";
import { RL } from "@/lib/security/rate-limit";
import { companies } from "@/lib/autotask/entities/companies";
import { autotaskErrorResponse } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";

// Firmensuche für den Firmenwechsel-Dialog (B15c).
export async function GET(req: Request) {
  const g = await guardApi(req, { rateLimit: RL.read });
  if (!g.ok) return g.res;
  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    const list = await companies.search(q);
    return NextResponse.json({ companies: list });
  } catch (e) {
    return autotaskErrorResponse(e);
  }
}
