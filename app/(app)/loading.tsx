import {
  KpiTilesSkeleton,
  ChartCardSkeleton,
  TableSkeleton,
} from "@/components/skeletons";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

// Dashboard-Skeleton: ECHTER Kopf (Titel/Beschreibung konstant) bleibt sofort
// stehen – nur die Daten darunter (KPI-Karten, Diagramm, Liste) sind Skeleton.
// So „springt" die Überschrift beim Navigieren nicht (Paul-Feedback).
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Übersicht"
        description="Deine Tickets auf einen Blick."
        actions={<Skeleton className="h-9 w-44 shrink-0 rounded-lg" />}
      />
      <KpiTilesSkeleton count={4} hint />
      <ChartCardSkeleton />
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-8 w-36" />
        </div>
        <Skeleton className="h-9 w-28" />
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
        <TableSkeleton columns={7} rows={6} breakpoint="lg" />
      </section>
    </div>
  );
}
