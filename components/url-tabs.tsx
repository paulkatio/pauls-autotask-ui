"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Wiederverwendbare URL-gesteuerte Tabs: der aktive Tab steht im `?<param>=`-Param,
// damit der Server nur die Daten des aktiven Tabs lädt und das Listen-Paging
// (`?cursor=`) den Tab behält. Beim Tabwechsel bleiben übrige Parameter (z. B. `q`
// auf /search) erhalten, nur `cursor` wird verworfen.
export function UrlTabs({
  active,
  tabs,
  children,
  param = "tab",
}: {
  active: string;
  tabs: { value: string; label: string }[];
  children: React.ReactNode;
  param?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(param, value);
    params.delete("cursor");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Tabs value={active} onValueChange={(v) => go(String(v))}>
      <TabsList variant="line" className="flex-wrap">
        {tabs.map((t) => (
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
