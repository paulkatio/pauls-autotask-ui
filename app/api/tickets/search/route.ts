import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { searchTickets, quickTicketSearch } from "@/lib/autotask/entities/search";
import { AutotaskError } from "@/lib/autotask/client";

export const dynamic = "force-dynamic";

// GET /api/tickets/search?q= — JSON-Ticketsuche für die Command-Palette (Cmd+K).
// Nutzt die bestehende Such-Logik (searchTickets, B08): Nummer/Titel/Firma/Kontakt.
// (Statischer Pfad „search" hat Vorrang vor [id] – kein Routing-Konflikt.)
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
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
    if (e instanceof AutotaskError) {
      const rateLimited = e.status === 429;
      return NextResponse.json(
        { error: `Autotask-Fehler (${e.status})`, rateLimited },
        { status: rateLimited ? 429 : 502 },
      );
    }
    return NextResponse.json({ error: "Unerwarteter Fehler" }, { status: 500 });
  }
}
