import {
  PageHeaderSkeleton,
  FiltersSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

// „Meine Tickets": Kopf mit Aktion + Filterleiste (Suche + Status/Priorität/Queue)
// + Ticket-Tabelle (mit Auswahl-Spalte) – gleiches Raster wie die echte Liste.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton action />
      <FiltersSkeleton search filters={3} />
      <TableSkeleton columns={6} rows={8} withCheckbox breakpoint="lg" />
    </div>
  );
}
