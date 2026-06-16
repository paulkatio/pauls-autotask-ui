"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-indicator";
import { PriorityBadge } from "@/components/priority-indicator";
import { cn } from "@/lib/utils";

// EINHEITLICHE Status-/Prioritäts-Selects für ALLE Stellen (Anlegen, Detail-Inline-Edit,
// Bulk). Trigger UND Optionen zeigen denselben Badge wie die Listen – damit Status/
// Priorität überall gleich aussehen, statt mal Klartext, mal Punkt, mal Badge.
// Rein präsentational: Wert kommt von außen, onChange meldet die Auswahl zurück.

export interface FieldSelectItem {
  value: string;
  label: string;
}

interface BaseProps {
  value: string;
  items: FieldSelectItem[];
  onChange: (value: string) => void;
  id?: string;
  ariaLabel?: string;
  disabled?: boolean;
  placeholder?: string;
  size?: "sm" | "default";
  className?: string;
}

export function StatusSelect({
  value,
  items,
  onChange,
  id,
  ariaLabel,
  disabled,
  placeholder = "Status wählen",
  size = "default",
  className,
}: BaseProps) {
  const selected = items.find((i) => i.value === value);
  return (
    <Select items={items} value={value} onValueChange={(v) => onChange(String(v))}>
      <SelectTrigger
        id={id}
        size={size}
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn("w-full", className)}
      >
        {selected ? (
          <StatusBadge status={Number(selected.value)} label={selected.label} />
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              <StatusBadge status={Number(i.value)} label={i.label} />
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function PrioritySelect({
  value,
  items,
  onChange,
  id,
  ariaLabel,
  disabled,
  placeholder = "Priorität wählen",
  size = "default",
  className,
}: BaseProps) {
  const selected = items.find((i) => i.value === value);
  return (
    <Select items={items} value={value} onValueChange={(v) => onChange(String(v))}>
      <SelectTrigger
        id={id}
        size={size}
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn("w-full", className)}
      >
        {selected ? (
          <PriorityBadge priority={Number(selected.value)} label={selected.label} />
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              <PriorityBadge priority={Number(i.value)} label={i.label} />
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
