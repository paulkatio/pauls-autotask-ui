import { Skeleton } from "@/components/ui/skeleton";

// Ticketdetail-Skeleton: Zurück-Link + Kopf (Titel + Meta-Chips) + responsives
// Layout aus Haupt- und Seitenpanel (wie die echte Detailansicht).
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-4 w-28" />
      <div className="flex min-w-0 flex-col gap-2">
        <Skeleton className="h-7 w-80 max-w-full" />
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
        <div className="flex w-full flex-col gap-4 md:max-w-sm">
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
