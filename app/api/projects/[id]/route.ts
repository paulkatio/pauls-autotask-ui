import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { autotask } from "@/lib/autotask/client";
import { autotaskErrorResponse } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";

// Inline-editierbare Projektfelder – BEWUSST nur die gegen die Sandbox als schreibbar
// verifizierten (DECISIONS.md, 2026-06-12):
//   - projectLeadResourceID  ✓ (darf null sein → kein Leiter)
//   - endDateTime (Fällig)   ✓
// NICHT aufgenommen, weil verifiziert NICHT schreibbar:
//   - status                 → PATCH ist ein No-Op (Wert ändert sich nie)
//   - completedPercentage    → isReadOnly (berechnet aus Aufgaben)
//   - startDateTime          → API-Fehler, sobald Aufgaben/Phasen existieren
const NULLABLE_NUMBER_FIELDS = ["projectLeadResourceID"] as const;
const DATE_FIELDS = ["endDateTime"] as const;

// Schreib-Guard: Projekt-Schreibpfade sind standardmäßig AUS. Erst nach der
// Sandbox-Verifikation (DECISIONS.md) wird PROJECT_WRITES_ENABLED=1 bewusst gesetzt –
// lokal für den Test gegen die Sandbox, in Prod beim Scharfschalten.
function writesEnabled(): boolean {
  return process.env.PROJECT_WRITES_ENABLED === "1";
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  if (!writesEnabled()) {
    return NextResponse.json(
      {
        error:
          "Projekt-Bearbeitung ist nicht aktiviert (PROJECT_WRITES_ENABLED fehlt).",
      },
      { status: 403 },
    );
  }

  const { id } = await params;
  const num = Number(id);
  if (!Number.isFinite(num)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json({ error: "Ungültiger Body" }, { status: 400 });
  }

  const data: Record<string, number | string | null> = {};

  for (const key of NULLABLE_NUMBER_FIELDS) {
    if (!(key in body)) continue;
    const v = body[key];
    if (v === null) {
      data[key] = null;
    } else {
      const n = Number(v);
      if (!Number.isFinite(n)) {
        return NextResponse.json(
          { error: `Ungültiger Wert für ${key}.` },
          { status: 400 },
        );
      }
      data[key] = n;
    }
  }

  for (const key of DATE_FIELDS) {
    if (!(key in body)) continue;
    const v = body[key];
    // Muss mit einem echten Datum beginnen (YYYY-MM-DD) und parsebar sein – nicht nur
    // „irgendein nicht-leerer String".
    if (
      typeof v !== "string" ||
      !/^\d{4}-\d{2}-\d{2}([T ].*)?$/.test(v) ||
      Number.isNaN(new Date(v).getTime())
    ) {
      return NextResponse.json(
        { error: `Ungültiger Wert für ${key}.` },
        { status: 400 },
      );
    }
    data[key] = v;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Keine Änderung." }, { status: 400 });
  }

  try {
    await autotask.update("Projects", { id: num, ...data });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return autotaskErrorResponse(e);
  }
}
