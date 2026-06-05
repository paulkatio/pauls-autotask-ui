import { AlertCircleIcon } from "lucide-react";

import { getSession } from "@/lib/auth";
import { getSecondaryOpenTickets } from "@/lib/autotask/entities/dashboard";
import { getTicketPicklists } from "@/lib/autotask/entities/picklists";
import { AutotaskError } from "@/lib/autotask/client";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { TicketsList } from "@/components/tickets/tickets-list";
import { PageHeader } from "@/components/page-header";
import { NewTicketDialog } from "@/components/tickets/new-ticket-dialog";

export const dynamic = "force-dynamic";

// Klickziel der Dashboard-Kachel K3: offene Tickets, in denen ich zusätzlicher
// Mitarbeiter (Secondary Resource) bin. Festes Set – keine Filterleiste.
export default async function SecondaryTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  if (!session) return null;

  const picklists = await getTicketPicklists();

  try {
    const data = await getSecondaryOpenTickets(
      session.autotaskResourceId,
      sp.cursor,
    );

    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Zusätzlicher Mitarbeiter"
          description="Offene Tickets, in denen du als zusätzlicher Mitarbeiter eingetragen bist."
          actions={<NewTicketDialog picklists={picklists} />}
        />
        <TicketsList
          data={data}
          picklists={picklists}
          filters={{ status: "open", priority: "", queue: "" }}
          columns={{ queue: true, assigned: true }}
          showFilters={false}
          searchMode="client"
          emptyDescription="Aktuell bist du in keinem offenen Ticket zusätzlicher Mitarbeiter."
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
