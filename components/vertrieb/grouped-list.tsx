"use client";

import * as React from "react";
import {
  FilterXIcon,
  LayersIcon,
  RotateCcwIcon,
  SearchIcon,
  SlidersHorizontalIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useColumnOrder } from "@/hooks/use-column-order";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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

// Ein Filter. value "alle" (bzw. allValue) = inaktiv. Mehrere Filter werden
// UND-verknüpft und stecken im Filter-Sheet.
export interface FilterDef<T> {
  id: string;
  label: string;
  icon: React.ReactNode;
  options: { value: string; label: string }[];
  predicate: (row: T, value: string) => boolean;
  allValue?: string;
}

const NONE = "none";

function parseValues(raw: string): Record<string, string> {
  if (!raw) return {};
  try {
    const o: unknown = JSON.parse(raw);
    return o && typeof o === "object" ? (o as Record<string, string>) : {};
  } catch {
    return {};
  }
}

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
  filters = [],
  filterTitle = "Filter",
  toolbarExtra,
  scopeLabel,
  note,
}: {
  rows: T[];
  columns: Column<T>[];
  searchText: (row: T) => string;
  searchPlaceholder: string;
  mobileCard?: (row: T) => React.ReactNode;
  hrefFor?: (row: T) => string;
  storageKey: string;
  // Prefix für die persistierten Toolbar-Einstellungen (Gruppierung/Filter).
  statePrefix: string;
  emptyIcon: React.ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  minWidthClass?: string;
  groupings: Grouping<T>[];
  filters?: FilterDef<T>[];
  filterTitle?: string;
  // Scope-Control (z. B. Zeitraum). Desktop = eigener Chip; mobil im Filter-Sheet.
  toolbarExtra?: React.ReactNode;
  scopeLabel?: string;
  // Hinweiszeile unter der Toolbar (z. B. „Liste gekürzt").
  note?: React.ReactNode;
}) {
  const [q, setQ] = React.useState("");
  // Spaltenreihenfolge teilt sich denselben Store (storageKey) mit der SearchableTable
  // -> der „Spalten zurücksetzen"-Button lebt hier oben in der Toolbar (rechts), nicht
  // als eigene Zeile in der Tabelle.
  const { customized, reset: resetColumns } = useColumnOrder(
    storageKey,
    columns.map((c) => c.key),
  );
  // Gruppierung + Filterwerte persistiert (localStorage, ohne Lade-Effect).
  const [groupBy, changeGroup] = usePersistentString(`${statePrefix}:group`, NONE);
  const [filtersRaw, setFiltersRaw] = usePersistentString(
    `${statePrefix}:filters`,
    "",
  );
  const filterValues = parseValues(filtersRaw);
  const valueOf = (f: FilterDef<T>) => filterValues[f.id] ?? f.allValue ?? "alle";
  const setFilter = (f: FilterDef<T>, v: string) =>
    setFiltersRaw(JSON.stringify({ ...filterValues, [f.id]: v }));
  const resetFilters = () => setFiltersRaw("");

  const groupItems = [{ value: NONE, label: "Keine" }, ...groupings];
  const active = groupings.find((g) => g.value === groupBy);

  // Aktive Filter (Wert ≠ „alle") UND-verknüpft anwenden.
  const activeFilters = filters.filter((f) => valueOf(f) !== (f.allValue ?? "alle"));
  const filteredRows = activeFilters.length
    ? rows.filter((r) => activeFilters.every((f) => f.predicate(r, valueOf(f))))
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
      ? filteredRows.filter((r) => searchText(r).toLowerCase().includes(term))
      : filteredRows;
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
        {/* Desktop: Suche + Steuerung nebeneinander in EINER Zeile (kein verschenkter
            Platz rechts); mobil gestapelt. */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <div className="relative w-full sm:w-64 sm:flex-none">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-11 pl-9 sm:h-9"
              aria-label={searchPlaceholder}
            />
          </div>

          {/* Ansicht (Gruppe) + Filter-Sheet + Zeitraum. */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-center">
          <Select
            items={groupItems}
            value={groupBy}
            onValueChange={(v) => changeGroup(String(v))}
          >
            <SelectTrigger
              size="sm"
              className="h-11 w-full min-w-0 sm:h-9 sm:w-auto"
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

          {filters.length > 0 && (
            <Sheet>
              <SheetTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-11 w-full min-w-0 justify-start gap-1.5 sm:h-9 sm:w-auto"
                  />
                }
                aria-label="Filter öffnen"
              >
                <SlidersHorizontalIcon className="text-muted-foreground" />
                {filterTitle}
                {activeFilters.length > 0 && (
                  <Badge variant="secondary" className="ml-auto tabular-nums sm:ml-1">
                    {activeFilters.length}
                  </Badge>
                )}
              </SheetTrigger>
              <SheetContent side="right" className="w-full gap-0 sm:max-w-sm">
                <SheetHeader>
                  <SheetTitle>{filterTitle}</SheetTitle>
                  <SheetDescription>Liste eingrenzen.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
                  {/* Scope (Zeitraum) mobil im Sheet; auf Desktop ist es ein Chip. */}
                  {toolbarExtra && (
                    <div className="flex flex-col gap-1.5 sm:hidden">
                      <span className="text-sm font-medium">
                        {scopeLabel ?? "Zeitraum"}
                      </span>
                      {toolbarExtra}
                    </div>
                  )}
                  {filters.map((f) => (
                    <div key={f.id} className="flex flex-col gap-1.5">
                      <span className="flex items-center gap-1.5 text-sm font-medium [&_svg]:size-4">
                        {f.icon}
                        {f.label}
                      </span>
                      <Select
                        items={f.options}
                        value={valueOf(f)}
                        onValueChange={(v) => setFilter(f, String(v))}
                      >
                        <SelectTrigger
                          size="sm"
                          className="h-11 w-full sm:h-9"
                          aria-label={f.label}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="w-(--anchor-width)">
                          <SelectGroup>
                            {f.options.map((i) => (
                              <SelectItem key={i.value} value={i.value}>
                                {i.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                <SheetFooter>
                  <Button
                    variant="outline"
                    onClick={resetFilters}
                    disabled={activeFilters.length === 0}
                  >
                    Filter zurücksetzen
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          )}

          {/* Zeitraum-Chip nur auf Desktop; mobil steckt er im Filter-Sheet. */}
          {toolbarExtra && (
            <div className="hidden sm:col-span-1 sm:block">{toolbarExtra}</div>
          )}

          {/* „Filter zurücksetzen" rechts neben den Chips, sobald ein Filter aktiv ist
              (nur Desktop – mobil sitzt der Reset im Sheet). */}
          {activeFilters.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-muted-foreground hidden sm:inline-flex"
            >
              <FilterXIcon />
              Filter zurücksetzen
            </Button>
          )}
          </div>

          {customized && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetColumns}
              className="w-full justify-start text-muted-foreground sm:ml-auto sm:w-auto"
            >
              <RotateCcwIcon />
              Spalten zurücksetzen
            </Button>
          )}
        </div>
        {note && <div className="text-muted-foreground text-xs">{note}</div>}
      </div>

      {!active ? (
        <SearchableTable rows={filteredRows} externalTerm={q} hideSearch {...sharedTable} />
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
