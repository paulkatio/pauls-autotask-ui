"use client";

import * as React from "react";

// Mini-Event-Bus: die Ticketdetailseite meldet Ticketnummer (+ Titel) an die globale
// Kopfzeile, sobald der Titel aus dem Sichtbereich nach oben gescrollt ist. So taucht
// die Nummer (Mobile) bzw. „Nummer – Titel" (Desktop) in der Header-Leiste auf.
// Kein globaler Store nötig – ein CustomEvent reicht.
const EVENT = "header-ticket-title";

export interface TicketHeaderInfo {
  number: string;
  title: string | null;
}

export function setHeaderTicketInfo(value: TicketHeaderInfo | null): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<TicketHeaderInfo | null>(EVENT, { detail: value }),
  );
}

export function useHeaderTicketInfo(): TicketHeaderInfo | null {
  const [value, setValue] = React.useState<TicketHeaderInfo | null>(null);
  React.useEffect(() => {
    const handler = (e: Event) =>
      setValue((e as CustomEvent<TicketHeaderInfo | null>).detail ?? null);
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);
  return value;
}
