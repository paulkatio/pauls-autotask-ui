import { FiltersSkeleton, TableSkeleton } from "@/components/skeletons";
import { PageHeader } from "@/components/page-header";

// Kontaktliste: ECHTER Kopf (konstant) bleibt sofort stehen; nur Suche +
// Firma-Filter + Tabelle sind Skeleton. Überschrift „springt" nicht.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Kontakte"
        description="Aktive Kontakte – tippen zum Suchen (Vor-/Nachname), Spaltenkopf zum Sortieren."
      />
      <FiltersSkeleton search filters={1} />
      <TableSkeleton columns={4} rows={10} minWidthClass="min-w-2xl" breakpoint="xl" />
    </div>
  );
}
