"use client";

import * as React from "react";
import { FilterIcon, LayersIcon, SearchIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { SearchableTable, type Column } from "@/components/searchable-table";
import { usePersistentString } from "@/hooks/use-persistent-string";

// Eine Gruppierungsart (z. B. „nach Firma"). keyOf liefert den Gruppen-Schlüssel,
// labelOf die Überschrift. sortGroups ordnet die Gruppen (Default: Label aufsteigend).
export interface Grouping<T> {
  value: string;
  label: string;
  keyOf: (row: T) => string;
  labelOf: (row: T) => string;
  sortGroups?: (
    a: { key: string; label: string },
    b: { key: string; label: string },
  ) => number;
}

export interface StatusFilterDef<T> {
  // Erste Option sollte „Alle" sein (value "alle" = kein Filter).
  options: { value: string; label: string }[];
  predicate: (row: T, value: string) => boolean;
}

const NONE = "none";

export function GroupedList<T extends { id: number | string }>({
  rows,
  columns,
  searchText,
  searchPlaceholder,
  mobileCard,
  hrefFor,
  storageKey,
  statePrefix,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  minWidthClass,
  groupings,
  statusFilter,
  toolbarExtra,
  note,
}: {
  rows: T[];
  columns: Column<T>[];
  searchText: (row: T) => string;
  searchPlaceholder: string;
  mobileCard?: (row: T) => React.ReactNode;
  hrefFor?: (row: T) => string;
  storageKey: string;
  // Prefix für die persistierten Toolbar-Einstellungen (Gruppierung/Status).
  statePrefix: string;
  emptyIcon: React.ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  minWidthClass?: string;
  groupings: Grouping<T>[];
  statusFilter?: StatusFilterDef<T>;
  // Zusätzliche Toolbar-Controls (z. B. Zeitraum-Auswahl) rechts neben den Selects.
  toolbarExtra?: React.ReactNode;
  // Hinweiszeile unter der Toolbar (z. B. „Liste gekürzt").
  note?: React.ReactNode;
}) {
  const [q, setQ] = React.useState("");
  // Gruppierung/Status persistiert (localStorage, ohne Lade-Effect/Hydration-Mismatch).
  const [groupBy, changeGroup] = usePersistentString(`${statePrefix}:group`, NONE);
  const [status, changeStatus] = usePersistentString(`${statePrefix}:status`, "alle");

  const groupItems = [{ value: NONE, label: "Keine" }, ...groupings];
  const active = groupings.find((g) => g.value === groupBy);

  const statusFiltered =
    statusFilter && status !== "alle"
      ? rows.filter((r) => statusFilter.predicate(r, status))
      : rows;

  const sharedTable = {
    columns,
    searchText,
    searchPlaceholder,
    mobileCard,
    hrefFor,
    storageKey,
    emptyIcon,
    emptyTitle,
    emptyDescription,
    minWidthClass,
  };

  // Gruppiert: nach Suche filtern, leere Gruppen überspringen, Gruppen ordnen.
  const term = q.trim().toLowerCase();
  let grouped: { key: string; label: string; rows: T[] }[] = [];
  if (active) {
    const searchFiltered = term
      ? statusFiltered.filter((r) => searchText(r).toLowerCase().includes(term))
      : statusFiltered;
    const map = new Map<string, { label: string; rows: T[] }>();
    for (const r of searchFiltered) {
      const key = active.keyOf(r);
      const entry = map.get(key);
      if (entry) entry.rows.push(r);
      else map.set(key, { label: active.labelOf(r), rows: [r] });
    }
    grouped = [...map.entries()].map(([key, v]) => ({ key, ...v }));
    const cmp = active.sortGroups;
    grouped.sort(
      cmp
        ? (a, b) => cmp({ key: a.key, label: a.label }, { key: b.key, label: b.label })
        : (a, b) => a.label.localeCompare(b.label, "de"),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {/* Suche zuerst (content-priority), volle Breite mobil. */}
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 pl-9 sm:h-9"
            aria-label={searchPlaceholder}
          />
        </div>

        {/* Filter: mobil gleichmäßiges 2-Spalten-Grid (keine random-Verteilung),
            ab sm inline. Zeitraum bekommt mobil eine eigene volle Zeile. */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Select
            items={groupItems}
            value={groupBy}
            onValueChange={(v) => changeGroup(String(v))}
          >
            <SelectTrigger
              size="sm"
              className="h-10 w-full min-w-0 sm:h-9 sm:w-auto"
              aria-label="Gruppieren nach"
            >
              <LayersIcon className="text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="w-auto min-w-48">
              <SelectGroup>
                <SelectLabel>Gruppieren nach</SelectLabel>
                {groupItems.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {statusFilter && (
            <Select
              items={statusFilter.options}
              value={status}
              onValueChange={(v) => changeStatus(String(v))}
            >
              <SelectTrigger
                size="sm"
                className="h-10 w-full min-w-0 sm:h-9 sm:w-auto"
                aria-label="Status filtern"
              >
                <FilterIcon className="text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-auto min-w-48">
                <SelectGroup>
                  <SelectLabel>Status</SelectLabel>
                  {statusFilter.options.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}

          {toolbarExtra && (
            <div className="col-span-2 sm:col-span-1">{toolbarExtra}</div>
          )}
        </div>
        {note && <div className="text-muted-foreground text-xs">{note}</div>}
      </div>

      {!active ? (
        <SearchableTable rows={statusFiltered} externalTerm={q} hideSearch {...sharedTable} />
      ) : grouped.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">{emptyIcon}</EmptyMedia>
            <EmptyTitle>{term ? "Keine Treffer" : emptyTitle}</EmptyTitle>
            <EmptyDescription>
              {term ? "Kein Eintrag passt zur Suche." : emptyDescription}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map((g) => (
            <section key={g.key} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">{g.label}</h2>
                <Badge variant="secondary" className="tabular-nums">
                  {g.rows.length}
                </Badge>
              </div>
              <SearchableTable rows={g.rows} hideSearch {...sharedTable} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
