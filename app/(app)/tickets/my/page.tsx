import { Suspense } from "react";

import { getSession } from "@/lib/auth";
import {
  getTicketsAll,
  ticketSearchFilter,
} from "@/lib/autotask/entities/ticket-list";
import { getTicketPicklists } from "@/lib/autotask/entities/picklists";
import { getAssignableResources } from "@/lib/autotask/entities/resources";
import { getSidebarTicketCounts } from "@/lib/autotask/entities/ticket-counts";
import { type AutotaskFilter } from "@/lib/autotask/client";
import { loadOrError } from "@/lib/data/load-or-error";
import { TicketsList } from "@/components/tickets/tickets-list";
import { SecondaryOpenTickets } from "@/components/tickets/secondary-open-tickets";
import { PageHeader } from "@/components/page-header";
import { NewTicketDialog } from "@/components/tickets/new-ticket-dialog";

export const dynamic = "force-dynamic";

interface SearchParams {
  status?: string;
  priority?: string;
  queue?: string;
  due?: string; // KPI-Prefilter vom Dashboard: overdue | today | sla
  q?: string; // Textsuche (Nummer/Titel)
}

// SLA-gefährdet identisch zur Dashboard-KPI (B13) – verfeinern in B15.
const SLA_RISK_HOURS = 4;

export default async function MyTicketsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  if (!session) return null; // Layout erzwingt bereits Login.

  const status = sp.status ?? "open";

  // Sichtbarkeit + Filter SERVERSEITIG. assignedResourceID ist nicht überschreibbar.
  const filter: AutotaskFilter[] = [
    { op: "eq", field: "assignedResourceID", value: session.autotaskResourceId },
  ];
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

  // KPI-Prefilter (Dashboard-Klick). Erzwingt offen + die jeweilige Dauer/SLA-Bedingung.
  if (sp.due) {
    const now = new Date();
    if (!filter.some((f) => f.field === "status")) {
      filter.push({ op: "noteq", field: "status", value: 5 });
    }
    if (sp.due === "overdue") {
      filter.push({ op: "lt", field: "dueDateTime", value: now.toISOString() });
    } else if (sp.due === "today") {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      filter.push({ op: "gte", field: "dueDateTime", value: start.toISOString() });
      filter.push({ op: "lte", field: "dueDateTime", value: end.toISOString() });
    } else if (sp.due === "sla") {
      const threshold = new Date(
        now.getTime() + SLA_RISK_HOURS * 3600 * 1000,
      ).toISOString();
      filter.push({
        op: "eq",
        field: "serviceLevelAgreementHasBeenMet",
        value: false,
      });
      filter.push({ op: "lte", field: "resolvedDueDateTime", value: threshold });
    }
  }

  // Textsuche (Nummer/Titel) – Paul-Feedback.
  filter.push(...ticketSearchFilter(sp.q));

  // Schnelles, gecachtes Beiwerk für Kopf + Toolbar (Picklists für die Filterchips,
  // Resourcen für die Bulk-Aktionen, Zähler für den Badge). NUR diese awaiten – sie
  // sind klein/gecacht, also schnell. Die (langsame) Ticketliste NICHT awaiten.
  const [picklists, assignableResources, counts] = await Promise.all([
    getTicketPicklists(),
    getAssignableResources(),
    getSidebarTicketCounts(session.autotaskResourceId).catch(() => null),
  ]);

  // Hauptliste als PROMISE an die Liste reichen (loadOrError fängt Fehler zu einem
  // Ergebnis, kein Throw). So rendern Kopf + Filterchips SOFORT; nur die Tabelle hängt
  // am Abruf (Suspense in TicketsList) und streamt nach.
  const ticketsResult = loadOrError(() => getTicketsAll(filter));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Meine Tickets"
        description="Dir zugewiesene Tickets – nach Status, Priorität und Queue filtern."
        badge={counts?.mine}
        actions={<NewTicketDialog picklists={picklists} />}
      />
      <TicketsList
        data={ticketsResult}
        picklists={picklists}
        filters={{
          status,
          priority: sp.priority ?? "",
          queue: sp.queue ?? "",
        }}
        selectable
        resources={assignableResources}
        myResourceId={session.autotaskResourceId}
        showPager={false}
        emptyDescription="Für die aktuelle Auswahl sind dir keine Tickets zugewiesen."
      />

      {/* Eigener Bereich „Als zusätzlicher Mitarbeiter": streamt eigenständig (eigener,
          potenziell langsamer Abruf) und blockiert daher die Hauptliste NICHT. Nur
          sichtbar, wenn es solche Tickets gibt. */}
      <Suspense fallback={null}>
        <SecondaryOpenTickets
          resourceId={session.autotaskResourceId}
          picklists={picklists}
        />
      </Suspense>
    </div>
  );
}
