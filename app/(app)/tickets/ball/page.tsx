import { AlertCircleIcon } from "lucide-react";

import { getSession } from "@/lib/auth";
import { getBallInMyCourtTickets } from "@/lib/autotask/entities/dashboard";
import { getTicketPicklists } from "@/lib/autotask/entities/picklists";
import { AutotaskError } from "@/lib/autotask/client";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
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

  try {
    const items = await getBallInMyCourtTickets(session.autotaskResourceId);

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
  } catch (e) {
    const rateLimited = e instanceof AutotaskError && e.status === 429;
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>Tickets konnten nicht geladen werden</AlertTitle>
        <AlertDescription>
          {rateLimited
            ? "Rate-Limit erreicht (429). Bitte kurz warten und erneut versuchen."
            : "Bitte später erneut versuchen."}
        </AlertDescription>
      </Alert>
    );
  }
}
