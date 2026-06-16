import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { companies } from "@/lib/autotask/entities/companies";
import { autotaskErrorResponse } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";

// Firmensuche für den Firmenwechsel-Dialog (B15c).
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    const list = await companies.search(q);
    return NextResponse.json({ companies: list });
  } catch (e) {
    return autotaskErrorResponse(e);
  }
}
