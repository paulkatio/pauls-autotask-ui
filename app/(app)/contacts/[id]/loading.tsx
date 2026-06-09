import { TableSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// Kontaktdetail: Zurück-Link + Kopf + Info-Karte + Tab-Leiste (Tickets) + Tabelle.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-4 w-24" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-40 rounded-lg" />
        <Skeleton className="h-8 w-48 rounded-lg" />
      </div>
      <TableSkeleton columns={7} rows={6} breakpoint="xl" />
    </div>
  );
}
