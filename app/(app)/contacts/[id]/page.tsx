import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Buildings,
  CaretLeft,
  Envelope,
  Phone,
  DeviceMobile,
} from "@phosphor-icons/react/ssr";

import { getSession } from "@/lib/auth";
import { contacts } from "@/lib/autotask/entities/contacts";
import { companies } from "@/lib/autotask/entities/companies";
import {
  getTicketsAll,
  ticketSearchFilter,
  sortByCreatedDesc,
  normalizeTicketWindow,
  ticketWindowStartISO,
  ticketWindowFilter,
} from "@/lib/autotask/entities/ticket-list";
import { getTicketPicklists } from "@/lib/autotask/entities/picklists";
import { getAssignableResources } from "@/lib/autotask/entities/resources";
import { type AutotaskFilter } from "@/lib/autotask/client";
import { currentMs } from "@/lib/format";
import { loadOrError } from "@/lib/data/load-or-error";
import { DataError } from "@/components/data-error";
import { PageHeader } from "@/components/page-header";
import { UrlTabs } from "@/components/url-tabs";
import { TicketsList } from "@/components/tickets/tickets-list";
import { TicketWindowSelect } from "@/components/tickets/ticket-window-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const VALID_TABS = ["offen", "abgeschlossen"] as const;
type Tab = (typeof VALID_TABS)[number];

const TICKET_TABS = [
  { value: "offen", label: "Offene Tickets" },
  { value: "abgeschlossen", label: "Abgeschlossene Tickets" },
];

export default async function ContactDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; win?: string; q?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const contactId = Number(id);
  if (!Number.isFinite(contactId)) notFound();

  const session = await getSession();
  if (!session) return null; // Layout erzwingt bereits Login.

  const tab: Tab = (VALID_TABS as readonly string[]).includes(sp.tab ?? "")
    ? (sp.tab as Tab)
    : "offen";

  const contactRes = await loadOrError(() => contacts.get(contactId));
  if (!contactRes.ok)
    return (
      <DataError
        title="Kontakt konnte nicht geladen werden"
        rateLimited={contactRes.rateLimited}
      />
    );
  const contact = contactRes.data;
  if (!contact) notFound();

  const name =
    `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() ||
    `Kontakt ${contactId}`;

  let companyName: string | null = null;
  if (contact.companyID != null) {
    try {
      const c = await companies.get(contact.companyID);
      companyName = c?.companyName ?? null;
    } catch {
      companyName = null;
    }
  }

  const [picklists, assignableResources] = await Promise.all([
    getTicketPicklists(),
    getAssignableResources(),
  ]);
  const closed = tab === "abgeschlossen";
  const win = normalizeTicketWindow(sp.win);
  const filter: AutotaskFilter[] = [
    { op: "eq", field: "contactID", value: contactId },
  ];
  filter.push(
    closed
      ? { op: "eq", field: "status", value: 5 }
      : { op: "noteq", field: "status", value: 5 },
  );
  // Abgeschlossene im Zeitfenster laden (B13: Server sortiert nicht -> Fenster +
  // Vollabruf + Client-Sort). Offene NIE nach Datum filtern (ein altes, weiterhin
  // offenes Ticket darf nicht verschwinden) -> nur laden und neueste zuerst.
  if (closed)
    filter.push(...ticketWindowFilter(ticketWindowStartISO(win, currentMs())));
  filter.push(...ticketSearchFilter(sp.q));

  const panelRes = await loadOrError(() =>
    getTicketsAll(filter, { withAssigned: true }),
  );

  let panel: ReactNode;
  if (!panelRes.ok) {
    panel = (
      <DataError
        title="Tickets konnten nicht geladen werden"
        rateLimited={panelRes.rateLimited}
      />
    );
  } else {
    const list = (
      <TicketsList
        data={{
          items: sortByCreatedDesc(panelRes.data.items),
          nextCursor: null,
          prevCursor: null,
        }}
        picklists={picklists}
        filters={{ status: closed ? "5" : "open", priority: "", queue: "" }}
        columns={{ assigned: true, company: false }}
        showFilters={false}
        showPager={false}
        selectable
        resources={assignableResources}
        myResourceId={session.autotaskResourceId}
        emptyDescription={
          closed
            ? "Dieser Kontakt hat im gewählten Zeitraum keine abgeschlossenen Tickets."
            : "Dieser Kontakt hat keine offenen Tickets."
        }
      />
    );
    panel = !closed ? (
      list
    ) : (
      <div className="flex flex-col gap-4">
        <TicketWindowSelect value={win} />
        {panelRes.data.capped && (
          <Alert>
            <AlertTitle>Nur die ersten 500 Tickets</AlertTitle>
            <AlertDescription>
              Im gewählten Zeitraum gibt es mehr als 500 abgeschlossene Tickets.
              Bitte den Zeitraum eingrenzen, um die neuesten vollständig zu sehen.
            </AlertDescription>
          </Alert>
        )}
        {list}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/contacts"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <CaretLeft className="size-4" />
        Kontakte
      </Link>

      <PageHeader title={name} description={contact.title || undefined} />

      <Card>
        <CardContent className="flex flex-col gap-2 py-6 text-sm">
          {contact.companyID != null ? (
            <div className="flex items-center gap-2">
              <Buildings className="text-muted-foreground size-4 shrink-0" />
              <Link
                href={`/companies/${contact.companyID}`}
                className="hover:underline"
              >
                {companyName ?? `Firma ${contact.companyID}`}
              </Link>
            </div>
          ) : null}
          {contact.emailAddress ? (
            <div className="flex items-center gap-2">
              <Envelope className="text-muted-foreground size-4 shrink-0" />
              <span>{contact.emailAddress}</span>
            </div>
          ) : null}
          {contact.phone ? (
            <div className="flex items-center gap-2">
              <Phone className="text-muted-foreground size-4 shrink-0" />
              <span className="tabular-nums">{contact.phone}</span>
            </div>
          ) : null}
          {contact.mobilePhone ? (
            <div className="flex items-center gap-2">
              <DeviceMobile className="text-muted-foreground size-4 shrink-0" />
              <span className="tabular-nums">{contact.mobilePhone}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <UrlTabs active={tab} tabs={TICKET_TABS}>
        {panel}
      </UrlTabs>
    </div>
  );
}
