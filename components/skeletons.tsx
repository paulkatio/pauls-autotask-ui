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
  // Spiegelt die echte Filterzeile: Suche volle Breite (mobil), darunter die Chips –
  // 3 Chips als 1×3, 4 Chips als 2×2 (je volle Zeilenbreite). Ab sm inhaltsbreit.
  const chipFill =
    filters >= 4
      ? "basis-[calc(50%-0.25rem)] grow sm:basis-auto sm:grow-0 sm:flex-none"
      : "flex-1 sm:flex-none";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {search && (
        <Skeleton className="h-11 w-full min-w-48 flex-1 rounded-lg sm:h-7 sm:max-w-xs" />
      )}
      {filters > 0 && (
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:items-center">
          {Array.from({ length: filters }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn(
                chipFill,
                "h-11 min-w-0 rounded-full sm:h-7 sm:w-36 sm:rounded-md",
              )}
            />
          ))}
        </div>
      )}
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
  breakpoint = "md",
}: {
  columns?: number;
  rows?: number;
  withCheckbox?: boolean;
  minWidthClass?: string;
  // Muss zum Card↔Table-Breakpoint der jeweiligen Liste passen, sonst springt das
  // Layout beim Laden (TicketsList = "xl", Companies/Contacts/SearchableTable = "lg").
  breakpoint?: "md" | "lg" | "xl";
}) {
  // Literale Klassennamen (nicht dynamisch zusammensetzen) – sonst findet sie der
  // Tailwind-JIT nicht.
  const cardHiddenClass = { md: "md:hidden", lg: "lg:hidden", xl: "xl:hidden" }[
    breakpoint
  ];
  const tableBlockClass = { md: "md:block", lg: "lg:block", xl: "xl:block" }[
    breakpoint
  ];
  return (
    <>
    {/* Mobile/Tablet: Karten-Skeletons (spiegeln das Karten-Layout der Listen). */}
    <div className={cn("flex flex-col gap-2", cardHiddenClass)}>
      {Array.from({ length: Math.min(rows, 6) }).map((_, r) => (
        <div key={r} className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-10" />
          </div>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </div>

    {/* Desktop: echte Tabellen-Struktur. */}
    <div className={cn("hidden overflow-x-auto rounded-lg border", tableBlockClass)}>
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
    </>
  );
}

// KPI-Kacheln im exakt gleichen Karten-Raster wie Dashboard/Kundenakte.
// `hint` rendert die einzeilige Erklär-Unterzeile mit (Dashboard-Kacheln) – sonst
// bleibt es bei Titel + Wert (Kundenakte/Zeiten ohne Unterzeile).
export function KpiTilesSkeleton({
  count = 4,
  gridClassName = "grid grid-cols-2 gap-4 lg:grid-cols-4",
  hint = false,
}: {
  count?: number;
  gridClassName?: string;
  hint?: boolean;
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
          {hint && <Skeleton className="h-3 w-32" />}
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
