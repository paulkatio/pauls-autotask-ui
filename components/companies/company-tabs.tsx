"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// URL-gesteuerte Tabs der Kundenakte (B3). Der aktive Tab steckt im `?tab=`-Param,
// damit der Server nur die Daten des aktiven Tabs lädt (kein 5-fach-Fetch) und das
// Paging der Ticket-Tabs (`?cursor=`) den Tab-Zustand behält. Beim Tabwechsel wird
// `cursor` verworfen (neuer Tab = neue Seite).
const TABS = [
  { value: "offen", label: "Offene Tickets" },
  { value: "abgeschlossen", label: "Abgeschlossene Tickets" },
  { value: "kontakte", label: "Kontakte" },
  { value: "geraete", label: "Geräte" },
  { value: "vertraege", label: "Verträge" },
];

export function CompanyTabs({
  active,
  children,
}: {
  active: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Tabs
      value={active}
      onValueChange={(v) => router.push(`${pathname}?tab=${String(v)}`)}
    >
      {/* Segmentiert (aktiver Tab im Vordergrund). h-auto + flex-wrap: die 5 Tabs
          brechen mobil sauber um (alle sichtbar), statt überlappend zu überlaufen. */}
      {/* Einheitlicher Tab-Stil (siehe vertrieb-tabs/url-tabs): segmentiert, mobil
          touch-hoch (h-11) + flex-1 → füllt umbrechende Zeilen gleichmäßig; Desktop
          kompakt (h-8) inhaltsbreit. */}
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
      <TabsContent value={active} className="mt-4">
        {children}
      </TabsContent>
    </Tabs>
  );
}
