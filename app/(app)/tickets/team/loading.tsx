import {
  PageHeaderSkeleton,
  FiltersSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

// Teamtickets: Kopf mit Aktion + Filter (Suche + Status/Priorität/Queue/Zuweisung)
// + Ticket-Tabelle (mit Auswahl-Spalte, alle Spalten inkl. Queue/Zugewiesen).
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton action />
      <FiltersSkeleton search filters={4} />
      <TableSkeleton columns={8} rows={8} withCheckbox />
    </div>
  );
}
