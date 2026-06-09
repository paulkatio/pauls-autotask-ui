import { KpiTilesSkeleton, TableSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// Kundenakte: Zurück-Link + Kopf (Name + Stammdaten-Zeile + Aktion) + 5 KPI-Kacheln
// + Tab-Leiste + Tabelle – gleiches Raster wie die echte Seite.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-4 w-20" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <Skeleton className="h-8 w-72 max-w-full" />
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <Skeleton className="h-9 w-52 shrink-0 rounded-lg" />
      </div>
      <KpiTilesSkeleton
        count={5}
        gridClassName="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
      />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-28 rounded-lg" />
        ))}
      </div>
      <TableSkeleton columns={7} rows={6} breakpoint="xl" />
    </div>
  );
}
