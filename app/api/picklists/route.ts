import { NextResponse } from "next/server";

import { getTicketPicklists } from "@/lib/autotask/entities/picklists";
import { guardApi } from "@/lib/security/api-guard";
import { RL } from "@/lib/security/rate-limit";

// Liefert die aufbereiteten Ticket-Picklists (status/priority/queue) für die UI.
// Caching/TTL (60 s) übernimmt getTicketPicklists (unstable_cache).
// Auth erforderlich: interne Daten gehören nicht an anonyme Aufrufer.
export async function GET(req: Request) {
  const g = await guardApi(req, { rateLimit: RL.read });
  if (!g.ok) return g.res;
  const picklists = await getTicketPicklists();
  return NextResponse.json(picklists);
}
