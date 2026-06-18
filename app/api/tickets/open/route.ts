import { NextResponse } from "next/server";

import { guardApi } from "@/lib/security/api-guard";
import { RL } from "@/lib/security/rate-limit";
import { getTicketsPage } from "@/lib/autotask/entities/ticket-list";
import { type AutotaskFilter } from "@/lib/autotask/client";
import { autotaskErrorResponse } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";

// GET /api/tickets/open?assigned=unassigned&cursor=… — offene Tickets team-weit
// (Status != Abgeschlossen=5), optional nur nicht zugewiesene. Versorgt den
// clientseitigen „Offene Tickets"-Abschnitt der Übersicht (Filter/Paging ohne
// Seiten-Neuladen). Reiner Lesepfad.
export async function GET(req: Request) {
  const g = await guardApi(req, { rateLimit: RL.read });
  if (!g.ok) return g.res;

  const url = new URL(req.url);
  const unassigned = url.searchParams.get("assigned") === "unassigned";
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const filter: AutotaskFilter[] = [
    { op: "noteq", field: "status", value: 5 },
  ];
  if (unassigned) {
    filter.push({ op: "notExist", field: "assignedResourceID" });
  }

  try {
    const data = await getTicketsPage(filter, {
      cursorUrl: cursor,
      withAssigned: true,
    });
    return NextResponse.json(data);
  } catch (e) {
    return autotaskErrorResponse(e);
  }
}
