import { NextResponse } from "next/server";

import { getTicketPicklists } from "@/lib/autotask/entities/picklists";

// Liefert die aufbereiteten Ticket-Picklists (status/priority/queue) für die UI.
// Caching/TTL (60 s) übernimmt getTicketPicklists (unstable_cache).
export async function GET() {
  const picklists = await getTicketPicklists();
  return NextResponse.json(picklists);
}
