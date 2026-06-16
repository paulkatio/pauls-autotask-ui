import { NextResponse } from "next/server";

import { AutotaskError } from "@/lib/autotask/client";

// Zentrale Fehler-Antwort für API-Route-Handler. Schließt den Rohfehler-Leak:
// nur kuratierte AutotaskError-Texte (Autotasks eigene errors[]-Feld-Rückmeldung)
// gehen an den Browser; jeder andere (interne) Fehler wird generisch.
//
//   - AutotaskError 429        → 429, rateLimited (UI zeigt Backoff-Hinweis)
//   - AutotaskError (sonst)    → 502, e.message (nutzerrelevantes Feld-Feedback)
//   - alles andere             → 500, "Unerwarteter Fehler" (kein Internal-Leak)
export function autotaskErrorResponse(e: unknown): NextResponse {
  if (e instanceof AutotaskError) {
    if (e.status === 429) {
      return NextResponse.json(
        { error: "Rate-Limit erreicht (429).", rateLimited: true },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
  return NextResponse.json({ error: "Unerwarteter Fehler" }, { status: 500 });
}
