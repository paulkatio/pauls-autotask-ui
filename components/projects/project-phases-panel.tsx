import { LayersIcon } from "lucide-react";

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
import type { ProjectPhase } from "@/lib/autotask/types";

// Phasen-Tab der Projektdetailseite (read-only). Unterphasen (parentPhaseID gesetzt)
// werden leicht eingerückt dargestellt.

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

function formatRange(start?: string | null, due?: string | null): string {
  if (!start && !due) return "—";
  return `${formatDate(start)} – ${formatDate(due)}`;
}

function formatHours(n?: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n} h`;
}

export function ProjectPhasesPanel({ rows }: { rows: ProjectPhase[] }) {
  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LayersIcon />
          </EmptyMedia>
          <EmptyTitle>Keine Phasen</EmptyTitle>
          <EmptyDescription>
            Für dieses Projekt sind keine Phasen angelegt.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      {/* Mobile/Tablet: Karten. */}
      <div className="grid grid-cols-1 gap-2 md:hidden">
        {rows.map((p) => (
          <div
            key={p.id}
            className={cn(
              "flex flex-col gap-1.5 rounded-lg border p-3",
              p.parentPhaseID != null && "border-l-2 border-l-muted-foreground/30",
            )}
          >
            <span className="text-sm font-medium break-words">
              {p.title ?? "—"}
            </span>
            <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs tabular-nums">
              <span>{formatRange(p.startDate, p.dueDate)}</span>
              <span>{formatHours(p.estimatedHours)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop ab md: Tabelle. */}
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Phase</TableHead>
              <TableHead>Zeitraum</TableHead>
              <TableHead>Geschätzt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell
                  className={cn(
                    "font-medium break-words",
                    p.parentPhaseID != null && "pl-8 font-normal",
                  )}
                >
                  {p.title ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums whitespace-nowrap">
                  {formatRange(p.startDate, p.dueDate)}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {formatHours(p.estimatedHours)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
