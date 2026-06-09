import {
  PageHeaderSkeleton,
  FiltersSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

// Kontaktliste: Kopf + Suche + Firma-Filter + Tabelle (Name/Firma/E-Mail/Telefon).
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <FiltersSkeleton search filters={1} />
      <TableSkeleton columns={4} rows={10} minWidthClass="min-w-2xl" breakpoint="xl" />
    </div>
  );
}
