"use client";

import { ListChecks } from "@phosphor-icons/react/ssr";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useTableSort, type SortValue } from "@/hooks/use-table-sort";
import { SortIcon } from "@/components/table-sort-icon";
import type { ProjectTaskRow } from "@/lib/autotask/entities/project-tasks";

// Aufgaben-Tab der Projektdetailseite (read-only). Karten unter md, Tabelle ab md –
// gleiches responsives Muster wie die übrigen Listen. Spaltenköpfe sind klickbar
// sortierbar (Desktop); die mobile Kartenliste behält die Server-Reihenfolge.

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function dateSort(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

// Aufgaben-Status (eigene Picklist): Abgeschlossen (5) gedämpft, sonst neutral.
function TaskStatus({ label, status }: { label: string | null; status?: number }) {
  if (!label) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant={status === 5 ? "secondary" : "outline"} className="font-normal">
      {label}
    </Badge>
  );
}

const COLUMNS: {
  key: string;
  header: string;
  sortValue: (t: ProjectTaskRow) => SortValue;
}[] = [
  { key: "title", header: "Aufgabe", sortValue: (t) => t.title ?? "" },
  { key: "status", header: "Status", sortValue: (t) => t.status ?? null },
  {
    key: "assigned",
    header: "Zugewiesen",
    sortValue: (t) => t.assignedName ?? "",
  },
  { key: "due", header: "Fällig", sortValue: (t) => dateSort(t.endDateTime) },
];

export function ProjectTasksPanel({ rows }: { rows: ProjectTaskRow[] }) {
  const { toggle, sortRows, ariaSort, sort } = useTableSort(COLUMNS);
  const sorted = sortRows(rows);

  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ListChecks />
          </EmptyMedia>
          <EmptyTitle>Keine Aufgaben</EmptyTitle>
          <EmptyDescription>
            Für dieses Projekt sind keine Aufgaben erfasst.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      {/* Mobile/Tablet: Karten (Server-Reihenfolge). */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:hidden">
        {rows.map((t) => (
          <div key={t.id} className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 text-sm font-medium break-words">
                {t.title ?? "—"}
              </span>
              <TaskStatus label={t.statusLabel} status={t.status} />
            </div>
            <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
              <span className="min-w-0 break-words">
                {t.assignedName ?? "Nicht zugewiesen"}
              </span>
              <span className="tabular-nums whitespace-nowrap">
                Fällig: {formatDate(t.endDateTime)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop ab md: Tabelle mit sortierbaren Spaltenköpfen. */}
      <div className="hidden overflow-x-auto rounded-lg border xl:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {COLUMNS.map((c) => (
                <TableHead
                  key={c.key}
                  aria-sort={ariaSort(c.key)}
                  className="group/sorthead cursor-pointer select-none"
                  title="Klicken zum Sortieren"
                  onClick={() => toggle(c.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.header}
                    <SortIcon
                      state={sort?.key === c.key ? sort.dir : "none"}
                    />
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium break-words">
                  {t.title ?? "—"}
                </TableCell>
                <TableCell>
                  <TaskStatus label={t.statusLabel} status={t.status} />
                </TableCell>
                <TableCell className="break-words">
                  {t.assignedName ?? (
                    <span className="text-muted-foreground">Nicht zugewiesen</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums whitespace-nowrap">
                  {formatDate(t.endDateTime)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
