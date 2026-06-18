import "server-only";

import { NextResponse } from "next/server";

// CSRF-Schutz für zustandsändernde API-Routen (POST/PATCH/PUT/DELETE).
//
// Die App authentifiziert über Cookies (Mock-Cookie bzw. Auth.js-JWT, beide
// SameSite=Lax). SameSite=Lax verhindert bereits, dass ein fremder Origin bei
// einem cross-site fetch/POST das Session-Cookie mitschickt – ABER als
// Defense-in-depth prüfen wir zusätzlich die Herkunft jedes schreibenden
// Requests serverseitig. Kein Token nötig: wir verlassen uns auf den vom Browser
// gesetzten, nicht fälschbaren `Sec-Fetch-Site`-Header und – als Fallback für
// ältere Browser – auf den `Origin`-Header gegen eine Host-Allowlist.

// Erlaubte Hosts: der eigene (Forwarded-)Host des Requests + optional die in
// AUTH_URL/NEXTAUTH_URL bzw. CSRF_TRUSTED_ORIGINS konfigurierten Origins.
function allowedHosts(req: Request): Set<string> {
  const hosts = new Set<string>();
  const add = (h: string | null | undefined) => {
    if (h) hosts.add(h.trim().toLowerCase());
  };
  // Hinter einem Reverse-Proxy (Caddy/Vercel) trägt X-Forwarded-Host den echten
  // Außen-Host. Beide berücksichtigen.
  req.headers.get("x-forwarded-host")?.split(",").forEach(add);
  add(req.headers.get("host"));
  for (const v of [process.env.AUTH_URL, process.env.NEXTAUTH_URL]) {
    if (!v) continue;
    try {
      add(new URL(v).host);
    } catch {
      /* ungültige URL ignorieren */
    }
  }
  const extra = process.env.CSRF_TRUSTED_ORIGINS;
  if (extra) {
    for (const raw of extra.split(",")) {
      const t = raw.trim();
      if (!t) continue;
      try {
        add(new URL(t).host);
      } catch {
        add(t); // erlaubt auch nackte Hostangaben
      }
    }
  }
  return hosts;
}

// True, wenn der Request als same-site gewertet werden darf.
export function isSameOriginRequest(req: Request): boolean {
  // 1) Sec-Fetch-Site (moderne Browser, nicht aus JS fälschbar). „cross-site"
  //    klar ablehnen; same-origin/same-site/none (direkte Navigation) erlauben.
  const secSite = req.headers.get("sec-fetch-site");
  if (secSite) {
    return (
      secSite === "same-origin" || secSite === "same-site" || secSite === "none"
    );
  }
  // 2) Fallback Origin-Header gegen die Host-Allowlist.
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return allowedHosts(req).has(new URL(origin).host.toLowerCase());
    } catch {
      return false;
    }
  }
  // 3) Weder Sec-Fetch-Site noch Origin vorhanden: kein Browser-Cross-Site-
  //    Kontext (z. B. Server-zu-Server/curl). Solche Clients tragen das
  //    SameSite=Lax-Cookie ohnehin nicht cross-site → durchlassen.
  return true;
}

// Liefert eine 403-Antwort, wenn der schreibende Request nicht same-site ist,
// sonst null. Aufrufer: `const bad = csrfResponse(req); if (bad) return bad;`
export function csrfResponse(req: Request): NextResponse | null {
  if (isSameOriginRequest(req)) return null;
  return NextResponse.json(
    { error: "Ungültige Herkunft der Anfrage (CSRF-Schutz)." },
    { status: 403 },
  );
}
