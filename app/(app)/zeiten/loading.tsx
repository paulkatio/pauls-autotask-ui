import {
  PageHeaderSkeleton,
  KpiTilesSkeleton,
  FiltersSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

// „Meine Zeiten": Kopf mit Aktion + 3 Summen-Karten + Suche + Tabelle.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton action />
      <KpiTilesSkeleton
        count={3}
        gridClassName="grid grid-cols-1 gap-4 sm:grid-cols-3"
      />
      <FiltersSkeleton search />
      <TableSkeleton columns={5} rows={8} minWidthClass="min-w-2xl" />
    </div>
  );
}
