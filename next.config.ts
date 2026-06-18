import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained Server-Bundle (.next/standalone/server.js) für Docker/Hetzner.
  // Auf Vercel ignoriert/kompatibel – keine Vercel-only-Abhängigkeit.
  output: "standalone",

  // Security-Header (Stufe 2). Greifen auf allen Routen. HSTS wirkt nur über HTTPS
  // (Prod/Vercel); lokal über http wirkungslos und unschädlich.
  //
  // Die Content-Security-Policy wird NICHT mehr hier gesetzt: sie ist jetzt eine
  // ERZWINGENDE, nonce-basierte Policy aus middleware.ts (Sicherheits-Audit N-5).
  // Ein Per-Request-Nonce ist in statischen next.config-Headern nicht möglich.
  async headers() {
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
        ],
      },
    ];
  },
};

export default nextConfig;
