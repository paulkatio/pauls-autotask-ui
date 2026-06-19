"use client";

import { usePathname } from "next/navigation";
import { CalendarBlank } from "@phosphor-icons/react/ssr";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { yearOptions } from "@/lib/vertrieb/year-window";
import { useProgressNav } from "@/hooks/use-progress-nav";

// Zeitraum-Auswahl für Rechnungen/Angebote/Verträge. Ändert die SERVER-Datenmenge
// (Jahresfenster), daher Navigation per ?zeitraum=. Werte: Jahreszahl (genau dieses
// Kalenderjahr) oder "alle". Default = aktuelles Jahr -> saubere URL ohne Param.
export function VertriebPeriodSelect({ value }: { value: string }) {
  const { navigate } = useProgressNav();
  const pathname = usePathname();
  const nowYear = new Date().getFullYear();
  const defaultValue = String(nowYear);
  const options = yearOptions(nowYear);
  const current = options.some((o) => o.value === value) ? value : defaultValue;

  return (
    <Select
      items={options}
      value={current}
      onValueChange={(v) => {
        const next = String(v);
        navigate(
          next === defaultValue ? pathname : `${pathname}?zeitraum=${next}`,
        );
      }}
    >
      <SelectTrigger
        size="sm"
        className="h-11 w-full min-w-0 sm:h-9 sm:w-auto"
        aria-label="Zeitraum"
      >
        <CalendarBlank className="text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="w-auto min-w-44">
        <SelectGroup>
          <SelectLabel>Zeitraum</SelectLabel>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
