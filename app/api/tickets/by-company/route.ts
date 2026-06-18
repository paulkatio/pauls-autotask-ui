import { NextResponse } from "next/server";

import { guardApi } from "@/lib/security/api-guard";
import { RL } from "@/lib/security/rate-limit";
import { tickets } from "@/lib/autotask/entities/tickets";
import { type AutotaskFilter } from "@/lib/autotask/client";
import { autotaskErrorResponse } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";

// GET /api/tickets/by-company?companyId=<n>&q=<term>
// Tickets einer Firma für den Ziel-Picker der Zusammenführung (B26). Optional nach
// Nummer/Titel gefiltert. Begrenzte Trefferzahl (50), keine Auto-Paginierung.
export async function GET(req: Request) {
  const g = await guardApi(req, { rateLimit: RL.search });
  if (!g.ok) return g.res;
  const url = new URL(req.url);
  const companyId = Number(url.searchParams.get("companyId"));
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!Number.isFinite(companyId)) {
    return NextResponse.json({ error: "companyId nötig" }, { status: 400 });
  }

  const filter: AutotaskFilter[] = [
    { op: "eq", field: "companyID", value: companyId },
  ];
  if (q) {
    filter.push({
      op: "or",
      items: [
        { op: "contains", field: "ticketNumber", value: q },
        { op: "contains", field: "title", value: q },
      ],
    });
  }

  try {
    const rows = await tickets.query(filter, {
      fields: ["id", "ticketNumber", "title", "status"],
      maxRecords: 50,
      autoPage: false,
    });
    return NextResponse.json({
      tickets: rows.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber ?? String(t.id),
        title: t.title ?? "",
        status: t.status,
      })),
    });
  } catch (e) {
    return autotaskErrorResponse(e);
  }
}
