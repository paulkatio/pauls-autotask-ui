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
      <TabsList variant="line" className="flex-wrap">
        {TABS.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
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
