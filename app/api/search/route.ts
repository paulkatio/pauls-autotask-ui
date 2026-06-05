import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import {
  searchColumnPage,
  type SearchKind,
} from "@/lib/autotask/entities/search";
import { AutotaskError } from "@/lib/autotask/client";

export const dynamic = "force-dynamic";

// GET /api/search?kind=&q=&token= — eine weitere Seite EINER Suchspalte (Mehr laden).
// `token` ist der opake Cursor aus der vorigen Antwort (keine Autotask-URL).
const KINDS: SearchKind[] = ["firma", "kontakt", "ticket-name", "ticket-nummer"];

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const params = new URL(req.url).searchParams;
  const kind = params.get("kind") ?? "";
  const q = params.get("q") ?? "";
  const token = params.get("token") ?? undefined;
  if (!KINDS.includes(kind as SearchKind)) {
    return NextResponse.json({ error: "Unbekannte Spalte" }, { status: 400 });
  }
  try {
    const result = await searchColumnPage(kind as SearchKind, q, token);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AutotaskError) {
      const rateLimited = e.status === 429;
      return NextResponse.json(
        { error: rateLimited ? "Rate-Limit erreicht (429)." : e.message, rateLimited },
        { status: rateLimited ? 429 : 502 },
      );
    }
    return NextResponse.json({ error: "Unerwarteter Fehler" }, { status: 500 });
  }
}
