import { FiltersSkeleton, TableSkeleton } from "@/components/skeletons";

// Kein Kopf-Skeleton: Die Tab-Leiste sitzt im Vertrieb-Layout und bleibt beim
// Wechsel stehen – hier lädt NUR der Inhalt (Filter + Tabelle) als Skeleton.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <FiltersSkeleton search filters={2} />
      <TableSkeleton columns={5} rows={10} breakpoint="xl" minWidthClass="min-w-3xl" />
    </div>
  );
}
