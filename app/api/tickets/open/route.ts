import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { getTicketsPage } from "@/lib/autotask/entities/ticket-list";
import { type AutotaskFilter } from "@/lib/autotask/client";
import { autotaskErrorResponse } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";

// GET /api/tickets/open?assigned=unassigned&cursor=… — offene Tickets team-weit
// (Status != Abgeschlossen=5), optional nur nicht zugewiesene. Versorgt den
// clientseitigen „Offene Tickets"-Abschnitt der Übersicht (Filter/Paging ohne
// Seiten-Neuladen). Reiner Lesepfad.
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

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
