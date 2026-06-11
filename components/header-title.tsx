"use client";

import { usePathname } from "next/navigation";

import { useHeaderTicketInfo } from "@/components/header-ticket-number";

// Zeigt im (sticky) Header den Titel der aktuellen Ansicht – reine Orientierung,
// liest nur den Pfad (keine Logik/Daten). Hält den Kontext beim Scrollen sichtbar.
function titleFor(pathname: string): string {
  if (pathname === "/") return "Übersicht";
  if (pathname.startsWith("/tickets/my")) return "Meine Tickets";
  if (pathname.startsWith("/tickets/team")) return "Teamtickets";
  if (pathname.startsWith("/projekte")) return "Projekte";
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
  const ticketInfo = useHeaderTicketInfo();
  // Auf einer Ticketdetailseite: sobald der Titel rausgescrollt ist, statt
  // „Ticketdetail" die Ticketnummer (Mobile) bzw. „Nummer – Titel" (Desktop) zeigen.
  const onTicketDetail = /^\/tickets\/\d+/.test(pathname);

  if (onTicketDetail && ticketInfo) {
    return (
      <span
        // Sanft von unten einblenden (symbolisiert das Hochscrollen des Titels in
        // die Kopfzeile). key → Animation spielt auch beim Ticketwechsel neu.
        key={ticketInfo.number}
        className="min-w-0 truncate text-sm font-medium duration-300 ease-out animate-in fade-in-0 slide-in-from-bottom-2"
        aria-current="page"
      >
        <span className="tabular-nums">{ticketInfo.number}</span>
        {ticketInfo.title && (
          <span className="hidden sm:inline"> – {ticketInfo.title}</span>
        )}
      </span>
    );
  }

  return (
    <span className="min-w-0 truncate text-sm font-medium" aria-current="page">
      {titleFor(pathname)}
    </span>
  );
}
