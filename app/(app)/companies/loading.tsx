import { FiltersSkeleton, TableSkeleton } from "@/components/skeletons";
import { PageHeader } from "@/components/page-header";

// Firmenliste: ECHTER Kopf (konstant) bleibt sofort stehen; nur Suche +
// Kundenart-Filter + Tabelle sind Skeleton. Überschrift „springt" nicht.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Firmen"
        description="Aktive Firmen – tippen zum Filtern, Spaltenkopf zum Sortieren."
      />
      <FiltersSkeleton search filters={1} />
      <TableSkeleton columns={5} rows={10} minWidthClass="min-w-2xl" breakpoint="xl" />
    </div>
  );
}
