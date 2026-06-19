"use client";

import { usePathname } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProgressNav } from "@/hooks/use-progress-nav";

// Pfad-basierte Unterreiter des Vertriebsbereichs. Anders als UrlTabs (ein Pfad,
// ?tab=-Param) sind das DREI eigene Routen – der aktive Tab ergibt sich aus dem
// Pfad, der Wechsel navigiert.
//
// WICHTIG: Diese Leiste sitzt im Section-Layout ([app/(app)/vertrieb/layout.tsx]),
// NICHT mehr in den einzelnen Seiten. Dadurch bleibt sie beim Tabwechsel stehen
// (kein Remount/Flackern der Chips); nur der Inhalt darunter wird neu geladen
// (zeigt dabei das jeweilige loading.tsx-Skelett, dazu der globale Ladebalken).
// Auf Detailseiten (/vertrieb/<x>/[id]) blendet sie sich selbst aus (dort führt ein
// Breadcrumb), ebenso auf der bloßen /vertrieb-Route.
const TABS = [
  { value: "rechnungen", label: "Rechnungen" },
  { value: "vertraege", label: "Verträge" },
  { value: "angebote", label: "Angebote" },
];

export function VertriebTabs() {
  const pathname = usePathname();
  const { navigate } = useProgressNav();

  // Nur auf den drei LISTEN-Routen anzeigen (exakter Pfad – schließt /[id]-Details aus).
  const match = TABS.find((t) => pathname === `/vertrieb/${t.value}`);
  if (!match) return null;

  return (
    <Tabs
      value={match.value}
      onValueChange={(v) => navigate(`/vertrieb/${String(v)}`)}
    >
      {/* sr-only H1 (a11y/Landmark) – sichtbar führt die aktive Tab-Leiste als
          Seitenüberschrift (kein doppeltes sichtbares H1 daneben). */}
      <h1 className="sr-only">{match.label}</h1>
      {/* Segmentiert (aktiver Tab im Vordergrund = erhabener Pill). h-auto + flex-wrap:
          mehrere Tabs brechen sauber in eine zweite Zeile um, statt zu überlaufen. */}
      <TabsList className="group-data-horizontal/tabs:h-auto max-w-full flex-wrap justify-start gap-1">
        {TABS.map((t) => (
          <TabsTrigger
            key={t.value}
            value={t.value}
            className="h-11 flex-1 sm:h-9 sm:flex-none"
          >
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
