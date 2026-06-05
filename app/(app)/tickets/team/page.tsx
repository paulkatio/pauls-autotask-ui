import { AlertCircleIcon } from "lucide-react";

import { getSession } from "@/lib/auth";
import {
  getTicketsPage,
  ticketSearchFilter,
} from "@/lib/autotask/entities/ticket-list";
import {
  resources,
  getAssignableResources,
} from "@/lib/autotask/entities/resources";
import { getTicketPicklists } from "@/lib/autotask/entities/picklists";
import { AutotaskError, type AutotaskFilter } from "@/lib/autotask/client";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { TicketsList } from "@/components/tickets/tickets-list";
import { PageHeader } from "@/components/page-header";
import { NewTicketDialog } from "@/components/tickets/new-ticket-dialog";

export const dynamic = "force-dynamic";

interface SearchParams {
  status?: string;
  priority?: string;
  queue?: string;
  assigned?: string;
  resource?: string; // Klick auf einen Balken im Dashboard-Chart
  q?: string; // Textsuche (Nummer/Titel)
  cursor?: string;
}

export default async function TeamTicketsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  if (!session) return null;

  const status = sp.status ?? "open";

  // Teamsicht: KEIN assignedResourceID-Filter (alle Personen). Default-Queue: keine
  // (alle offenen Tickets aller Queues); die Queue-Auswahl in der Filterleiste
  // grenzt ein. Kein Rollen-Gating (B12-Entscheidung) – für alle sichtbar.
  const filter: AutotaskFilter[] = [];
  if (status === "open") {
    filter.push({ op: "noteq", field: "status", value: 5 });
  } else if (status !== "all") {
    const n = Number(status);
    if (Number.isFinite(n)) filter.push({ op: "eq", field: "status", value: n });
  }
  const prio = Number(sp.priority);
  if (sp.priority && Number.isFinite(prio)) {
    filter.push({ op: "eq", field: "priority", value: prio });
  }
  const queue = Number(sp.queue);
  if (sp.queue && Number.isFinite(queue)) {
    filter.push({ op: "eq", field: "queueID", value: queue });
  }
  // Pool-Blick: nur nicht zugewiesene (assignedResourceID ist null). Operator
  // "notExist" (in B12 verifiziert) – serverseitig, damit Paging intakt bleibt.
  if (sp.assigned === "unassigned") {
    filter.push({ op: "notExist", field: "assignedResourceID" });
  }
  // Mitarbeiter-Filter (Klick auf einen Balken im Dashboard-Chart): nur Tickets
  // dieser Resource. Hat Vorrang vor dem Pool-Blick.
  const resourceId = Number(sp.resource);
  if (sp.resource && Number.isFinite(resourceId)) {
    filter.push({ op: "eq", field: "assignedResourceID", value: resourceId });
  }
  // Sicht ist bereits auf eine Person eingegrenzt (Chart-Klick) → der Assignment-
  // Filter „Alle / nur nicht zugewiesene" ergibt hier keinen Sinn und wird ausgeblendet.
  const scopedToResource = Boolean(sp.resource) && Number.isFinite(resourceId);
  // Textsuche (Nummer/Titel) – Paul-Feedback.
  filter.push(...ticketSearchFilter(sp.q));
  // Autotask verlangt mindestens eine Filterbedingung: bei "Alle" einen No-Op setzen.
  if (filter.length === 0) {
    filter.push({ op: "gte", field: "id", value: 0 });
  }

  // Überschrift je nach Blick: Mitarbeiter (Chart-Klick), Pool oder Teamtickets.
  let heading = "Teamtickets";
  if (sp.resource && Number.isFinite(resourceId)) {
    const names = await resources.namesByIds([resourceId]);
    heading = `Tickets von ${names.get(resourceId) ?? `#${resourceId}`}`;
  } else if (sp.assigned === "unassigned") {
    heading = "Nicht zugewiesene Tickets";
  }

  const [picklists, assignableResources] = await Promise.all([
    getTicketPicklists(),
    getAssignableResources(),
  ]);

  try {
    const data = await getTicketsPage(filter, {
      cursorUrl: sp.cursor,
      withAssigned: true,
    });

    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title={heading}
          description="Tickets im gesamten Team – filtern, dem Pool entnehmen und zuweisen."
          actions={<NewTicketDialog picklists={picklists} />}
        />
        <TicketsList
          data={data}
          picklists={picklists}
          filters={{
            status,
            priority: sp.priority ?? "",
            queue: sp.queue ?? "",
            assigned: sp.assigned ?? "",
          }}
          columns={{ queue: true, assigned: true }}
          assignmentFilter={!scopedToResource}
          selectable
          resources={assignableResources}
          myResourceId={session.autotaskResourceId}
          emptyDescription="Für die aktuelle Auswahl gibt es keine Teamtickets."
        />
      </div>
    );
  } catch (e) {
    const rateLimited = e instanceof AutotaskError && e.status === 429;
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>Teamtickets konnten nicht geladen werden</AlertTitle>
        <AlertDescription>
          {rateLimited
            ? "Rate-Limit erreicht (429). Bitte kurz warten und erneut versuchen."
            : "Bitte später erneut versuchen."}
        </AlertDescription>
      </Alert>
    );
  }
}
