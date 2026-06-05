import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertCircleIcon,
  Building2Icon,
  ChevronLeftIcon,
  MailIcon,
  PhoneIcon,
  SmartphoneIcon,
} from "lucide-react";

import { getSession } from "@/lib/auth";
import { contacts } from "@/lib/autotask/entities/contacts";
import { companies } from "@/lib/autotask/entities/companies";
import {
  getTicketsPage,
  ticketSearchFilter,
} from "@/lib/autotask/entities/ticket-list";
import { getTicketPicklists } from "@/lib/autotask/entities/picklists";
import { getAssignableResources } from "@/lib/autotask/entities/resources";
import { AutotaskError, type AutotaskFilter } from "@/lib/autotask/client";
import { PageHeader } from "@/components/page-header";
import { UrlTabs } from "@/components/url-tabs";
import { TicketsList } from "@/components/tickets/tickets-list";
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
  searchParams: Promise<{ tab?: string; cursor?: string; q?: string }>;
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

  let contact;
  try {
    contact = await contacts.get(contactId);
  } catch (e) {
    return <LoadError entity="Kontakt" rateLimited={isRateLimited(e)} />;
  }
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
  const filter: AutotaskFilter[] = [
    { op: "eq", field: "contactID", value: contactId },
  ];
  if (tab === "offen") {
    filter.push({ op: "noteq", field: "status", value: 5 });
  } else {
    filter.push({ op: "eq", field: "status", value: 5 });
  }
  filter.push(...ticketSearchFilter(sp.q));

  let panel: React.ReactNode;
  try {
    const data = await getTicketsPage(filter, {
      cursorUrl: sp.cursor,
      withAssigned: true,
    });
    panel = (
      <TicketsList
        data={data}
        picklists={picklists}
        filters={{ status: tab === "offen" ? "open" : "5", priority: "", queue: "" }}
        columns={{ assigned: true, company: false }}
        showFilters={false}
        showPager
        selectable
        resources={assignableResources}
        myResourceId={session.autotaskResourceId}
        emptyDescription={
          tab === "offen"
            ? "Dieser Kontakt hat keine offenen Tickets."
            : "Dieser Kontakt hat keine abgeschlossenen Tickets."
        }
      />
    );
  } catch (e) {
    panel = <LoadError entity="Tickets" rateLimited={isRateLimited(e)} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/contacts"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeftIcon className="size-4" />
        Kontakte
      </Link>

      <PageHeader title={name} description={contact.title || undefined} />

      <Card>
        <CardContent className="flex flex-col gap-2 py-6 text-sm">
          {contact.companyID != null ? (
            <div className="flex items-center gap-2">
              <Building2Icon className="text-muted-foreground size-4 shrink-0" />
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
              <MailIcon className="text-muted-foreground size-4 shrink-0" />
              <span>{contact.emailAddress}</span>
            </div>
          ) : null}
          {contact.phone ? (
            <div className="flex items-center gap-2">
              <PhoneIcon className="text-muted-foreground size-4 shrink-0" />
              <span className="tabular-nums">{contact.phone}</span>
            </div>
          ) : null}
          {contact.mobilePhone ? (
            <div className="flex items-center gap-2">
              <SmartphoneIcon className="text-muted-foreground size-4 shrink-0" />
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

function isRateLimited(e: unknown): boolean {
  return e instanceof AutotaskError && e.status === 429;
}

function LoadError({
  entity,
  rateLimited,
}: {
  entity: string;
  rateLimited: boolean;
}) {
  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertTitle>{entity} konnten nicht geladen werden</AlertTitle>
      <AlertDescription>
        {rateLimited
          ? "Rate-Limit erreicht (429). Bitte kurz warten und erneut versuchen."
          : "Bitte später erneut versuchen."}
      </AlertDescription>
    </Alert>
  );
}
