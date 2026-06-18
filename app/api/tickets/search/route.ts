import { NextResponse } from "next/server";

import { guardApi } from "@/lib/security/api-guard";
import { RL } from "@/lib/security/rate-limit";
import { searchTickets, quickTicketSearch } from "@/lib/autotask/entities/search";
import { autotaskErrorResponse } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";

// GET /api/tickets/search?q= — JSON-Ticketsuche für die Command-Palette (Cmd+K).
// Nutzt die bestehende Such-Logik (searchTickets, B08): Nummer/Titel/Firma/Kontakt.
// (Statischer Pfad „search" hat Vorrang vor [id] – kein Routing-Konflikt.)
export async function GET(req: Request) {
  const g = await guardApi(req, { rateLimit: RL.search });
  if (!g.ok) return g.res;
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const scope = url.searchParams.get("scope"); // name | number | (default: breit)
  if (!q.trim()) return NextResponse.json({ items: [] });
  try {
    // Spotlight-Spalten: auf ein Feld begrenzte Suche (Titel bzw. Nummer).
    if (scope === "name" || scope === "number") {
      const field = scope === "name" ? "title" : "ticketNumber";
      const items = await quickTicketSearch(q, field, 8);
      return NextResponse.json({ items });
    }
    const page = await searchTickets(q);
    const items = page.items.slice(0, 8).map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber ?? null,
      title: t.title ?? null,
      companyName: t.companyName ?? null,
    }));
    return NextResponse.json({ items });
  } catch (e) {
    return autotaskErrorResponse(e);
  }
}
