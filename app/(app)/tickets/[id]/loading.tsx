import { Skeleton } from "@/components/ui/skeleton";

// Ticketdetail-Skeleton – spiegelt das echte Layout: Kopf (Titel + „In Autotask
// öffnen") und 3 Spalten (Ticketinformationen · Mitte mit Beschreibung/Chat/
// Zeiten-Kasten/Aktivität · Kontext).
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Kopf: Nummer–Titel + Erstellt, rechts „In Autotask öffnen". */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Skeleton className="h-7 w-80 max-w-full" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="ml-auto h-9 w-36 rounded-lg" />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:flex-wrap lg:items-start xl:flex-nowrap">
        {/* Linke Schiene: Ticketinformationen */}
        <div className="flex w-full flex-col gap-4 lg:w-72 lg:shrink-0">
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>

        {/* Mitte: Beschreibung, Chat, Zeiten-Kasten, Aktivität (eingeklappt). */}
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>

        {/* Rechte Schiene: Kontext (Firma/Kontakt + Arbeitszeit). */}
        <div className="flex w-full flex-col gap-4 xl:w-72 xl:shrink-0 2xl:w-80">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
