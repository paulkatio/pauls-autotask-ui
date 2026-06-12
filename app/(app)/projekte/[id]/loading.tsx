import {
  PageHeaderSkeleton,
  KpiTilesSkeleton,
  TableSkeleton,
} from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// Spiegelt das echte Detail-Layout: Kopf + Meta-Zeile + KPI-Kacheln + Tab-Tabelle.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <div className="flex flex-wrap gap-8">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-40" />
      </div>
      <KpiTilesSkeleton count={4} />
      <Skeleton className="h-9 w-48" />
      <TableSkeleton columns={4} rows={6} breakpoint="md" minWidthClass="min-w-2xl" />
    </div>
  );
}
