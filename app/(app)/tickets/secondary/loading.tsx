import {
  PageHeaderSkeleton,
  FiltersSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

// Nebentickets (zusätzlicher Mitarbeiter): Kopf mit Aktion + Suche + Tabelle
// (inkl. Queue/Zugewiesen).
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton action />
      <FiltersSkeleton search />
      <TableSkeleton columns={8} rows={8} />
    </div>
  );
}
