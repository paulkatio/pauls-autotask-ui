"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProgressNav } from "@/hooks/use-progress-nav";
import { cn } from "@/lib/utils";

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
  const { navigate, pending } = useProgressNav();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(param, value);
    params.delete("cursor");
    navigate(`${pathname}?${params.toString()}`);
  }

  return (
    <Tabs value={active} onValueChange={(v) => go(String(v))}>
      {/* Segmentiert (aktiver Tab im Vordergrund). h-auto + flex-wrap: saubere zweite
          Zeile bei vielen/langen Tabs statt Überlauf. */}
      <TabsList className="group-data-horizontal/tabs:h-auto max-w-full flex-wrap justify-start gap-1">
        {tabs.map((t) => (
          <TabsTrigger
            key={t.value}
            value={t.value}
            className="h-11 flex-1 sm:h-9 sm:flex-none"
          >
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {/* Inhalt beim Tabwechsel dezent abdimmen, solange der Server nachlädt –
          die Tab-Leiste bleibt voll bedienbar (kein Einfrier-Eindruck). */}
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
