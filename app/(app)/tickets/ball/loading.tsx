import {
  PageHeaderSkeleton,
  FiltersSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

// „Ball liegt bei mir": Kopf mit Aktion + Suche + Ticket-Tabelle.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton action />
      <FiltersSkeleton search />
      <TableSkeleton columns={6} rows={8} breakpoint="xl" />
    </div>
  );
}
