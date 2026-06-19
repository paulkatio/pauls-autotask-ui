"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProgressNav } from "@/hooks/use-progress-nav";
import { cn } from "@/lib/utils";

// URL-gesteuerte Tabs der Projektdetailseite (`?tab=`), analog zur Kundenakte
// ([company-tabs.tsx]). Der Server lädt nur die Daten des aktiven Tabs – kein
// Doppel-Fetch von Aufgaben UND Phasen.
const TABS = [
  { value: "aufgaben", label: "Aufgaben" },
  { value: "phasen", label: "Phasen" },
];

export function ProjectTabs({
  active,
  children,
}: {
  active: string;
  children: React.ReactNode;
}) {
  const { navigate, pending } = useProgressNav();
  const pathname = usePathname();

  return (
    <Tabs
      value={active}
      onValueChange={(v) => navigate(`${pathname}?tab=${String(v)}`)}
    >
      {/* Einheitlicher segmentierter Tab-Stil (siehe vertrieb-tabs/url-tabs). */}
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
      <TabsContent
        value={active}
        className={cn(
          "mt-4 transition-opacity",
          pending && "pointer-events-none opacity-60",
        )}
      >
        {children}
      </TabsContent>
    </Tabs>
  );
}
