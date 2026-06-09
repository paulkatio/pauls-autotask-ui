import {
  PageHeaderSkeleton,
  KpiTilesSkeleton,
  ChartCardSkeleton,
  TableSkeleton,
} from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// Dashboard-Skeleton: spiegelt Kopf + 4 KPI-Karten + Diagramm-Karte +
// „Zuletzt bearbeitet"-Tabelle (gleiches Raster wie die echte Seite).
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <KpiTilesSkeleton count={4} />
      <ChartCardSkeleton />
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-8 w-36" />
        </div>
        <Skeleton className="h-9 w-28" />
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
        <TableSkeleton columns={7} rows={6} breakpoint="xl" />
      </section>
    </div>
  );
}
