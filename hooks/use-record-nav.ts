import { useRouter } from "next/navigation";

import { useInAppNav } from "@/hooks/use-in-app-nav";
import { openCompanyPopup, openTicketPopup } from "@/lib/open-popup";

// Einheitlicher Einstieg, um einen Datensatz zu öffnen. Entscheidet beim Tippen,
// ob IN der App navigiert wird (mobil/PWA – Zurück-Geste funktioniert, kein neuer
// Tab) oder ob das Autotask-artige Pop-out-Fenster aufgeht (Desktop).
//
// WICHTIG: Nur den Click-Handler branchen, nie das gerenderte Markup – useInAppNav()
// ist vor dem Mount false (SSR-sicher); Navigation passiert erst nach Hydration per
// Tap, daher ist der Anfangswert unkritisch.
export function useRecordNav() {
  const router = useRouter();
  const inApp = useInAppNav();

  function openTicket(id: number) {
    if (inApp) router.push(`/tickets/${id}`);
    else openTicketPopup(id);
  }

  function openCompany(id: number) {
    if (inApp) router.push(`/companies/${id}`);
    else openCompanyPopup(id);
  }

  return { openTicket, openCompany };
}
