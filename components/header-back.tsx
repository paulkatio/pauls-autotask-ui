"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

// Mobiler Zurück-Button im App-Header. Nur auf Detailseiten (Ticket/Firma) und nur
// mobil sichtbar – seit die Detailansicht mobil IN der App geöffnet wird
// (useRecordNav), braucht es ein verlässliches Zurück. Im Pop-out-Fenster taucht
// dieser Header nicht auf (app/popup/* hat ein eigenes Layout), daher hier zentral.
//
// Fallback (Paul): bei direktem Deep-Link/geteiltem Link führt blindes back() ins
// Leere oder auf eine externe Seite. Nur zurückgehen, wenn echte same-origin
// In-App-History existiert; sonst auf ein sinnvolles Listenziel pushen.
const DETAIL_ROUTES: { re: RegExp; fallback: string }[] = [
  { re: /^\/tickets\/\d+$/, fallback: "/tickets/my" },
  { re: /^\/companies\/\d+$/, fallback: "/companies" },
  { re: /^\/projekte\/\d+$/, fallback: "/projekte" },
];

export function HeaderBack() {
  const pathname = usePathname();
  const router = useRouter();

  const match = DETAIL_ROUTES.find((d) => d.re.test(pathname));
  if (!match) return null;

  function goBack() {
    const ref = document.referrer;
    const sameOrigin =
      !!ref && new URL(ref).origin === window.location.origin;
    if (window.history.length > 1 && sameOrigin) {
      router.back();
    } else {
      router.push(match!.fallback);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-11 md:hidden"
      aria-label="Zurück"
      onClick={goBack}
    >
      <ArrowLeftIcon />
    </Button>
  );
}
