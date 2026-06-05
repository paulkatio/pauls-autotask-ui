"use client";

import { usePathname } from "next/navigation";

// Zeigt im (sticky) Header den Titel der aktuellen Ansicht – reine Orientierung,
// liest nur den Pfad (keine Logik/Daten). Hält den Kontext beim Scrollen sichtbar.
function titleFor(pathname: string): string {
  if (pathname === "/") return "Übersicht";
  if (pathname.startsWith("/tickets/my")) return "Meine Tickets";
  if (pathname.startsWith("/tickets/team")) return "Teamtickets";
  if (pathname.startsWith("/tickets/secondary")) return "Zusätzlicher Mitarbeiter";
  if (pathname.startsWith("/tickets/ball")) return "Ball liegt bei mir";
  if (pathname.startsWith("/tickets/")) return "Ticketdetail";
  if (pathname.startsWith("/zeiten")) return "Meine Zeiten";
  if (pathname.startsWith("/companies")) return "Firmen";
  if (pathname.startsWith("/contacts")) return "Kontakte";
  if (pathname.startsWith("/search")) return "Suche";
  if (pathname.startsWith("/admin")) return "Admin";
  return "Autotask UI";
}

export function HeaderTitle() {
  const pathname = usePathname();
  return (
    <span className="min-w-0 truncate text-sm font-medium" aria-current="page">
      {titleFor(pathname)}
    </span>
  );
}
