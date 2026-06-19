import { FiltersSkeleton, TableSkeleton } from "@/components/skeletons";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

// „Ball liegt bei mir": ECHTER Kopf (konstant) bleibt sofort stehen; nur Suche +
// Tabelle sind Skeleton. Überschrift „springt" beim Navigieren nicht.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ball liegt bei mir"
        description="Offene Tickets, bei denen die letzte Aktivität vom Kunden kam."
        actions={<Skeleton className="h-9 w-44 shrink-0 rounded-lg" />}
      />
      <FiltersSkeleton search />
      <TableSkeleton columns={6} rows={8} breakpoint="lg" />
    </div>
  );
}
