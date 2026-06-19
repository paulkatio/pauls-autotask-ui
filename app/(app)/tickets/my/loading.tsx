import { FiltersSkeleton, TableSkeleton } from "@/components/skeletons";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

// „Meine Tickets": ECHTER Kopf (konstant) bleibt sofort stehen; nur Filter +
// Tabelle sind Skeleton – die Überschrift „springt" beim Navigieren nicht.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Meine Tickets"
        description="Dir zugewiesene Tickets – nach Status, Priorität und Queue filtern."
        actions={<Skeleton className="h-9 w-44 shrink-0 rounded-lg" />}
      />
      <FiltersSkeleton search filters={3} />
      <TableSkeleton columns={6} rows={8} withCheckbox breakpoint="lg" />
    </div>
  );
}
