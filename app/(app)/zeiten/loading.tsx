import {
  PageHeaderSkeleton,
  FiltersSkeleton,
  TableSkeleton,
} from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// „Meine Zeiten": Kopf mit Aktion + 3 Summen-Karten + Suche + Tabelle.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton action />
      {/* Stat-Zeile (spiegelt die echte flex-wrap-Textzeile, KEINE KPI-Kacheln). */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-44" />
      </div>
      <FiltersSkeleton search />
      <TableSkeleton columns={5} rows={8} minWidthClass="min-w-2xl" breakpoint="xl" />
    </div>
  );
}
