import { PageHeaderSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// Suche: Kopf + große Suchleiste + 4-Spalten-Ergebnisraster (Firma/Kontakte/
// Ticket-Name/Ticket-Nummer) – gleiches Raster wie die echten Ergebnisse.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <Skeleton className="h-12 w-full max-w-2xl rounded-lg" />
      <div className="bg-border grid grid-cols-1 gap-px overflow-hidden rounded-lg border sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, col) => (
          <div key={col} className="bg-card flex flex-col gap-1 p-2">
            <div className="flex items-center gap-1.5 px-2 py-1.5">
              <Skeleton className="size-3.5 rounded-sm" />
              <Skeleton className="h-3.5 w-24" />
            </div>
            {Array.from({ length: 6 }).map((_, r) => (
              <div key={r} className="flex flex-col gap-1.5 px-2 py-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
