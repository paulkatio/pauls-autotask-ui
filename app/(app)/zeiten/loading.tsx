import { FiltersSkeleton, TableSkeleton } from "@/components/skeletons";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

// „Meine Zeiten": ECHTER Kopf (konstant) bleibt sofort stehen; nur Stat-Zeile +
// Suche + Tabelle sind Skeleton. Überschrift „springt" beim Navigieren nicht.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Meine Zeiten"
        description="Deine erfassten Zeiten – heute oder in dieser Woche."
        actions={<Skeleton className="h-9 w-44 shrink-0 rounded-lg" />}
      />
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
