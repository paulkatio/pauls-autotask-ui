import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained Server-Bundle (.next/standalone/server.js) für Docker/Hetzner.
  // Auf Vercel ignoriert/kompatibel – keine Vercel-only-Abhängigkeit.
  output: "standalone",

  // Security-Header (Stufe 2). Greifen auf allen Routen. HSTS wirkt nur über HTTPS
  // (Prod/Vercel); lokal über http wirkungslos und unschädlich.
  async headers() {
    // CSP bewusst als REPORT-ONLY: blockt nichts, meldet nur Verstöße (Browser-
    // Konsole). Dient dazu, vor dem echten Scharfschalten zu sehen, was bricht.
    // 'unsafe-inline'/'unsafe-eval' sind nötig, weil Next.js (Hydration/Bootstrap)
    // und Tiptap Inline-Scripts/Styles nutzen; echtes Enforcen bräuchte später
    // Nonces (Middleware). default-src 'self' fängt Fremd-Origins (Script/Bild/
    // Fetch) ab -> macht ungewollte externe Ressourcen sichtbar.
    const cspReportOnly = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          {
            // preload = bewusste, Domain-weite Verpflichtung. Der Header allein
            // genügt NICHT für die Aufnahme – die Domain muss zusätzlich unter
            // hstspreload.org eingereicht werden.
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          {
            key: "Content-Security-Policy-Report-Only",
            value: cspReportOnly,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
