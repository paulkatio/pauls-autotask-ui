"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { TICKET_WINDOW_DEFAULT } from "@/lib/autotask/ticket-window";

// Zeitraum-Auswahl für abgeschlossene Tickets (Firmen-/Kontaktakte). Schreibt `?win=`
// in die URL; der Default (24 Monate) wird aus der URL ausgelassen, damit der
// kanonische Link kurz bleibt. Server holt anhand des Fensters die Daten neu.
const ITEMS = [
  { label: "Letzte 24 Monate", value: "24m" },
  { label: "Letzte 12 Monate", value: "12m" },
  { label: "Dieses + letztes Jahr", value: "yearsTwo" },
  { label: "Alle (max. 500)", value: "all" },
];

export function TicketWindowSelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === TICKET_WINDOW_DEFAULT) params.delete("win");
    else params.set("win", next);
    router.push(`${pathname}?${params.toString()}`);
  }

  const active = value !== TICKET_WINDOW_DEFAULT;

  return (
    <div className="flex items-center gap-2 self-start">
      <span className="text-muted-foreground text-sm">Zeitraum</span>
      <Select
        items={ITEMS}
        value={value}
        onValueChange={(v) => onChange(String(v))}
      >
        <SelectTrigger
          size="sm"
          className={cn(
            "h-11 w-auto min-w-44 sm:h-9",
            active
              ? "border-transparent bg-secondary font-medium text-secondary-foreground"
              : "border-input text-foreground",
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="w-auto min-w-52">
          <SelectGroup>
            {ITEMS.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
