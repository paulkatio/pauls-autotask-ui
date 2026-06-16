import { getSession } from "@/lib/auth";
import { getBallInMyCourtTickets } from "@/lib/autotask/entities/dashboard";
import { getTicketPicklists } from "@/lib/autotask/entities/picklists";
import { loadOrError } from "@/lib/data/load-or-error";
import { DataError } from "@/components/data-error";
import { TicketsList } from "@/components/tickets/tickets-list";
import { PageHeader } from "@/components/page-header";
import { NewTicketDialog } from "@/components/tickets/new-ticket-dialog";

export const dynamic = "force-dynamic";

// Klickziel der Dashboard-Kachel K4: meine offenen Tickets, bei denen die letzte
// Aktivität vom Kunden kam (lastActivityPersonType === 2). Clientseitig gefiltert
// (Feld isQueryable:false), ≤500-Approx-Muster – daher kein Server-Paging.
export default async function BallInMyCourtPage() {
  const session = await getSession();
  if (!session) return null;

  const picklists = await getTicketPicklists();

  const res = await loadOrError(() =>
    getBallInMyCourtTickets(session.autotaskResourceId),
  );
  if (!res.ok)
    return (
      <DataError
        title="Tickets konnten nicht geladen werden"
        rateLimited={res.rateLimited}
      />
    );
  const items = res.data;

    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Ball liegt bei mir"
          description="Offene Tickets, bei denen die letzte Aktivität vom Kunden kam."
          actions={<NewTicketDialog picklists={picklists} />}
        />
        <TicketsList
          data={{ items, nextCursor: null, prevCursor: null }}
          picklists={picklists}
          filters={{ status: "open", priority: "", queue: "" }}
          showFilters={false}
          showPager={false}
          searchMode="client"
          emptyDescription="Bei keinem deiner offenen Tickets liegt der Ball gerade bei dir."
        />
      </div>
    );
}
