"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Mehrfach-Auswahl der Mitarbeiter für die Team-Ticketliste (ersetzt den Queue-Filter).
// Bewusst ein echtes base-ui `Select multiple` – so ist der Chip pixelgleich zu den
// anderen Filter-Selects (Status/Priorität/Tickets) und automatisch genauso
// responsive. Rein präsentational: Auswahl kommt von außen, `onChange` meldet die
// neue Menge zurück. Der Standard (alle außer Philipp König) sowie die Persistenz
// liegen im Aufrufer.
export interface ResourceFilterOption {
  id: number;
  name: string;
}

export function ResourceFilter({
  options,
  selected,
  onChange,
  active,
  className,
}: {
  options: ResourceFilterOption[];
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
  // true = Auswahl weicht vom Standard ab -> Chip wird dezent eingefärbt (wie die anderen).
  active: boolean;
  className?: string;
}) {
  const total = options.length;
  const count = options.reduce((n, o) => (selected.has(o.id) ? n + 1 : n), 0);
  const label =
    count === total
      ? "Alle Mitarbeiter"
      : count === 0
        ? "Keine Mitarbeiter"
        : `Mitarbeiter (${count}/${total})`;

  // base-ui Select.multiple arbeitet mit einem Werte-Array; wir spiegeln die aktuell
  // sichtbaren, ausgewählten Optionen hinein und melden Änderungen als Set zurück.
  const value = options.filter((o) => selected.has(o.id)).map((o) => String(o.id));

  return (
    <Select
      multiple
      value={value}
      onValueChange={(vals) =>
        onChange(new Set((vals as string[]).map((v) => Number(v))))
      }
    >
      <SelectTrigger
        size="sm"
        aria-label="Mitarbeiter filtern"
        className={cn(
          "h-11 w-full min-w-0 sm:h-9",
          active
            ? "border-transparent bg-secondary font-medium text-secondary-foreground"
            : "border-input text-foreground",
          className,
        )}
      >
        <span className="line-clamp-1 flex-1 text-left">{label}</span>
      </SelectTrigger>
      <SelectContent className="w-auto min-w-56">
        <SelectGroup>
          {options.map((o) => (
            <SelectItem key={o.id} value={String(o.id)}>
              {o.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
