import { FiltersSkeleton, TableSkeleton } from "@/components/skeletons";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

// Teamtickets: ECHTER Kopf (konstant; der Standardtitel „Teamtickets" – bei
// eingegrenzten Blicken setzt die Seite den finalen Titel) bleibt sofort stehen;
// nur Filter + Tabelle sind Skeleton. Überschrift „springt" beim Navigieren nicht.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Teamtickets"
        description="Tickets im gesamten Team – filtern, dem Pool entnehmen und zuweisen."
        actions={<Skeleton className="h-9 w-44 shrink-0 rounded-lg" />}
      />
      <FiltersSkeleton search filters={4} />
      <TableSkeleton columns={8} rows={8} withCheckbox breakpoint="lg" />
    </div>
  );
}
