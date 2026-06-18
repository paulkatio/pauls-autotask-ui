import { NextResponse, type NextRequest } from "next/server";

// Erzwingende Content-Security-Policy mit Per-Request-Nonce (Sicherheits-Audit N-5).
// Ersetzt die frühere reine Report-Only-CSP aus next.config.ts: Skripte laufen nur
// noch mit dem Nonce dieses Requests ('strict-dynamic' überträgt das Vertrauen auf
// die von Next nachgeladenen Chunks), nicht mehr über 'unsafe-inline'/'unsafe-eval'.
//
// Next.js liest den Nonce aus dem auf dem REQUEST gesetzten CSP-Header und versieht
// seine eigenen Bootstrap-/Runtime-Skripte automatisch damit. Das Root-Layout reicht
// denselben Nonce an next-themes (Inline-Theme-Skript) weiter.
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV !== "production";

  const csp = [
    "default-src 'self'",
    // Nur genonceter Code + davon geladene Skripte. In DEV braucht Next für
    // React-Refresh/HMR zusätzlich 'unsafe-eval' (in Prod NICHT gesetzt).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline-style-Attribute (Recharts/Tiptap/next-themes/next-font) lassen sich nicht
    // noncen → 'unsafe-inline' für Styles bleibt nötig. Style-Injektion ist deutlich
    // weniger gefährlich als Script-Injektion.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next.js extrahiert den Nonce aus diesem Request-Header.
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // CSP nur auf Dokument-Antworten; statische Assets, Bilder, API und Auth-Endpoints
  // brauchen keinen Nonce (und sollen nicht pro Request dynamisch werden).
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|txt)).*)",
  ],
};
