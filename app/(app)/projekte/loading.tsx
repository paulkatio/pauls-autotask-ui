import { FiltersSkeleton, TableSkeleton } from "@/components/skeletons";
import { PageHeader } from "@/components/page-header";

// „Projekte": ECHTER Kopf (konstant) bleibt sofort stehen; nur Umschalter/Suche-
// Zeile + Tabelle sind Skeleton. Überschrift „springt" beim Navigieren nicht.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Projekte"
        description="Projekte, die du leitest oder in denen du mitarbeitest – plus der Blick auf alle aktiven Projekte."
      />
      <FiltersSkeleton search filters={2} />
      <TableSkeleton columns={7} rows={8} breakpoint="xl" />
    </div>
  );
}
