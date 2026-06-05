import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Wiederverwendbare Skeletons, die das ECHTE Raster der Inhalte spiegeln
// (Paul-Feedback: Skeletons müssen zum tatsächlichen Layout passen). Sie nutzen
// dieselben Bausteine (Table, Card-Maße, Grids) wie die fertigen Seiten.

export function PageHeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      {action && <Skeleton className="h-9 w-44 shrink-0 rounded-lg" />}
    </div>
  );
}

// Filterleiste: breites Suchfeld + n schmale Filter (wie in den Listen).
export function FiltersSkeleton({
  filters = 0,
  search = true,
}: {
  filters?: number;
  search?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {search && (
        <Skeleton className="h-9 w-full min-w-48 flex-1 rounded-lg sm:max-w-xs" />
      )}
      {Array.from({ length: filters }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-36 rounded-lg" />
      ))}
    </div>
  );
}

// Tabelle: gleiche Hülle (overflow-x-auto + Border) + echte Table-Struktur mit
// Kopf- und Datenzeilen → die Spalten/Zeilen liegen exakt im selben Raster.
export function TableSkeleton({
  columns = 6,
  rows = 8,
  withCheckbox = false,
  minWidthClass = "min-w-3xl",
}: {
  columns?: number;
  rows?: number;
  withCheckbox?: boolean;
  minWidthClass?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className={minWidthClass}>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            {withCheckbox && (
              <TableHead className="w-px">
                <Skeleton className="size-4 rounded-sm" />
              </TableHead>
            )}
            {Array.from({ length: columns }).map((_, i) => (
              <TableHead key={i}>
                <Skeleton className="h-4 w-16" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, r) => (
            <TableRow key={r}>
              {withCheckbox && (
                <TableCell className="w-px">
                  <Skeleton className="size-4 rounded-sm" />
                </TableCell>
              )}
              {Array.from({ length: columns }).map((_, c) => (
                <TableCell key={c}>
                  <Skeleton className={cn("h-4", c === 1 ? "w-44" : "w-20")} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// KPI-Kacheln im exakt gleichen Karten-Raster wie Dashboard/Kundenakte.
export function KpiTilesSkeleton({
  count = 4,
  gridClassName = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
}: {
  count?: number;
  gridClassName?: string;
}) {
  return (
    <div className={gridClassName}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-card flex h-full flex-col gap-3 rounded-xl border p-6"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

// Karte mit Diagramm (z. B. „Tickets pro Mitarbeiter").
export function ChartCardSkeleton() {
  return (
    <div className="bg-card flex flex-col gap-4 rounded-xl border p-6">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
