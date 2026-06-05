import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained Server-Bundle (.next/standalone/server.js) für Docker/Hetzner.
  // Auf Vercel ignoriert/kompatibel – keine Vercel-only-Abhängigkeit.
  output: "standalone",
};

export default nextConfig;
