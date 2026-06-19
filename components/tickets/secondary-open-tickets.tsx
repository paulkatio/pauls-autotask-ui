import { getSecondaryOpenTickets } from "@/lib/autotask/entities/dashboard";
import { Badge } from "@/components/ui/badge";
import { TicketsList } from "@/components/tickets/tickets-list";
import type { TicketPicklists } from "@/lib/autotask/types";

// Eigener Bereich unter „Meine Tickets": offene Tickets, in denen ich zusätzlicher
// Mitarbeiter bin (nicht mir zugewiesen, aber mit mir verbunden). Als EIGENE Server-
// Komponente in einer Suspense-Insel der Seite – so blockiert dieser (potenziell
// langsame) Zweitabruf NICHT den Seiten-Shell/die Hauptliste. Nur sichtbar, wenn es
// solche Tickets gibt (kein leerer Block). Read-only (keine Auswahl): fremde Tickets
// werden hier nicht gebündelt bearbeitet. Best effort: ein Fehler darf die Seite nicht
// kippen.
export async function SecondaryOpenTickets({
  resourceId,
  picklists,
}: {
  resourceId: number;
  picklists: TicketPicklists;
}) {
  const secondary = await getSecondaryOpenTickets(resourceId).catch(() => ({
    items: [],
    nextCursor: null,
    prevCursor: null,
  }));
  if (secondary.items.length === 0) return null;

  return (
    <section className="flex flex-col gap-4 border-t pt-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        Als zusätzlicher Mitarbeiter
        <Badge
          variant="secondary"
          className="bg-chart-2/15 text-chart-2 tabular-nums"
        >
          {secondary.items.length}
        </Badge>
      </h2>
      <TicketsList
        data={secondary}
        picklists={picklists}
        filters={{ status: "open", priority: "", queue: "" }}
        columns={{ assigned: true }}
        showFilters={false}
        showPager={false}
        searchMode="off"
        emptyDescription="Aktuell bist du in keinem offenen Ticket zusätzlicher Mitarbeiter."
      />
    </section>
  );
}
