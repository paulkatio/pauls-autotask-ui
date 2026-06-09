"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCcwIcon, SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useColumnOrder } from "@/hooks/use-column-order";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

// Wiederverwendbare, durchsuchbare Tabelle für vollständig geladene Listen
// (Paul-Feedback: „immer eine Suche"). Spaltenbreiten **automatisch** (kein
// table-fixed, keine harten px-Breiten) → Spalten passen sich dem Inhalt an;
// Textspalten umbrechen, `min-w-*` sorgt fürs saubere Scrollen am Handy.
export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  headClassName?: string;
  cellClassName?: string;
}

export function SearchableTable<T extends { id: number | string }>({
  rows,
  columns,
  searchText,
  searchPlaceholder,
  hrefFor,
  onRowClick,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  minWidthClass = "min-w-2xl",
  storageKey,
  mobileCard,
}: {
  rows: T[];
  columns: Column<T>[];
  searchText: (row: T) => string;
  searchPlaceholder: string;
  hrefFor?: (row: T) => string;
  // Alternativ zu hrefFor: beliebige Aktion beim Zeilenklick (z. B. Overlay öffnen).
  onRowClick?: (row: T) => void;
  emptyIcon: React.ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  minWidthClass?: string;
  // Eindeutiger Schlüssel für die persistierte Spaltenreihenfolge (Drag & Drop).
  storageKey: string;
  // Optionaler, massgeschneiderter Karteninhalt für Mobile. Ohne Angabe wird aus
  // den Spalten eine generische Karte gebaut (erste Spalte = Titel, Rest Label/Wert).
  mobileCard?: (row: T) => React.ReactNode;
}) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const term = q.trim().toLowerCase();
  const filtered = term
    ? rows.filter((r) => searchText(r).toLowerCase().includes(term))
    : rows;

  const columnMap = React.useMemo(
    () => Object.fromEntries(columns.map((c) => [c.key, c])) as Record<string, Column<T>>,
    [columns],
  );
  const { order, headProps, reset, customized } = useColumnOrder(
    storageKey,
    columns.map((c) => c.key),
  );
  const orderedColumns = order.map((k) => columnMap[k]).filter(Boolean);

  const handleRow = onRowClick
    ? onRowClick
    : hrefFor
      ? (row: T) => router.push(hrefFor(row))
      : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full min-w-48 flex-1 sm:max-w-xs">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
            aria-label={searchPlaceholder}
          />
        </div>
        {customized && (
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            className="text-muted-foreground"
          >
            <RotateCcwIcon />
            Spalten zurücksetzen
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
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
        <>
        {/* Mobile/Tablet: bis xl je Zeile eine Karte (Tabelle würde sonst bis ~1280
            rechts klippen). */}
        <div className="flex flex-col gap-2 xl:hidden">
          {filtered.map((row) => (
            <div
              key={String(row.id)}
              {...(handleRow
                ? {
                    role: "button" as const,
                    tabIndex: 0,
                    onClick: () => handleRow(row),
                    onKeyDown: (e: React.KeyboardEvent) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleRow(row);
                      }
                    },
                  }
                : {})}
              className={cn(
                "flex flex-col gap-1.5 rounded-lg border p-3",
                handleRow &&
                  "hover:bg-muted/50 active:bg-muted cursor-pointer transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              )}
            >
              {mobileCard
                ? mobileCard(row)
                : orderedColumns.map((c, i) =>
                    i === 0 ? (
                      <div key={c.key} className="text-sm font-medium break-words">
                        {c.cell(row)}
                      </div>
                    ) : (
                      <div
                        key={c.key}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="text-muted-foreground text-xs">
                          {c.header}
                        </span>
                        <span className="min-w-0 text-right">{c.cell(row)}</span>
                      </div>
                    ),
                  )}
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto rounded-lg border xl:block">
          <Table className={cn(minWidthClass)}>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {orderedColumns.map((c) => (
                  <TableHead
                    key={c.key}
                    className={cn(
                      "data-[dragover]:bg-accent data-[dragging]:opacity-60 cursor-grab transition-colors select-none active:cursor-grabbing",
                      c.headClassName,
                    )}
                    title="Spalte ziehen, um die Reihenfolge zu ändern"
                    {...headProps(c.key)}
                  >
                    {c.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow
                  key={String(row.id)}
                  className={handleRow ? "cursor-pointer" : undefined}
                  onClick={handleRow ? () => handleRow(row) : undefined}
                >
                  {orderedColumns.map((c) => (
                    <TableCell key={c.key} className={c.cellClassName}>
                      {c.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </>
      )}
    </div>
  );
}
