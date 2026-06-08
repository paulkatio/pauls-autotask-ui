import type { MetadataRoute } from "next";

import { getOrgName } from "@/lib/branding-server";

// PWA-Manifest. Next serviert das als /manifest.webmanifest und fügt das
// <link rel="manifest"> automatisch in den <head> ein (siehe app/layout.tsx).
//
// Bewusst OHNE Service Worker / Offline-Modus: Dies ist ein Live-Daten-Werkzeug
// gegen die Autotask-API; veraltete, gecachte Ansichten wären schädlich.
// Siehe docs/DECISIONS.md "PWA-Basis ohne Service Worker".
//
// theme_color/background_color hier = Hell-Variante (Eggshell, v2-Token). Die
// adaptive Hell/Dunkel-Umschaltung der Browser-Leiste passiert über den
// viewport-Export in app/layout.tsx (media-Queries) – das Manifest erlaubt nur
// einen statischen Wert.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const orgName = await getOrgName();
  return {
    id: "/",
    name: `${orgName} Tickets`,
    short_name: "Tickets",
    description:
      "Fokussierte Oberfläche für Autotask – Dashboard, Ticketlisten und Ticket-Chat.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fdfcfb", // Eggshell (v2 --background hell)
    theme_color: "#fdfcfb",
    lang: "de",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
