import {
  PageHeaderSkeleton,
  FiltersSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

// „Projekte": Kopf + Umschalter/Suche-Zeile (Meine/Alle + Suchfeld) + Projekt-
// Tabelle – gleiches Raster wie die echte Liste (Karten unter xl, Tabelle ab xl).
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <FiltersSkeleton search filters={2} />
      <TableSkeleton columns={7} rows={8} breakpoint="xl" />
    </div>
  );
}
