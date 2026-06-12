"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
