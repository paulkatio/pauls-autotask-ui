import {
  PageHeaderSkeleton,
  FiltersSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

// Firmenliste: Kopf + Suche + Kundenart-Filter + Tabelle (Name/Ort/Kundenart/
// Telefon/Offene Tickets).
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <FiltersSkeleton search filters={1} />
      <TableSkeleton columns={5} rows={10} minWidthClass="min-w-2xl" />
    </div>
  );
}
