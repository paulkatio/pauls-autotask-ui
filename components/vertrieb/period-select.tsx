"use client";

import { usePathname, useRouter } from "next/navigation";
import { CalendarRangeIcon } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Zeitraum-Auswahl für Rechnungen/Angebote. Ändert die SERVER-Datenmenge (Zeitfenster),
// daher Navigation per ?zeitraum=. Werte: "standard" (seit Vorjahr), Jahreszahl
// (seit JJJJ) oder "alle". Kurze Labels, damit der Trigger auch mobil passt.
export function periodOptions(nowYear: number) {
  return [
    { value: "standard", label: `Seit ${nowYear - 1}` },
    { value: String(nowYear - 3), label: `Seit ${nowYear - 3}` },
    { value: String(nowYear - 5), label: `Seit ${nowYear - 5}` },
    { value: "alle", label: "Alle" },
  ];
}

export function VertriebPeriodSelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const options = periodOptions(new Date().getFullYear());
  const current = options.some((o) => o.value === value) ? value : "standard";

  return (
    <Select
      items={options}
      value={current}
      onValueChange={(v) => {
        const next = String(v);
        router.push(next === "standard" ? pathname : `${pathname}?zeitraum=${next}`);
      }}
    >
      <SelectTrigger
        size="sm"
        className="h-11 w-full min-w-0 sm:h-9! sm:w-auto"
        aria-label="Zeitraum"
      >
        <CalendarRangeIcon className="text-muted-foreground" />
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
