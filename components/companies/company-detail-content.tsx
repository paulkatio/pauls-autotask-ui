import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertCircleIcon,
  ChevronLeftIcon,
  CircleCheckIcon,
  FileTextIcon,
  GlobeIcon,
  MapPinIcon,
  MonitorIcon,
  PhoneIcon,
  TicketIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

import { getSession } from "@/lib/auth";
import { companies } from "@/lib/autotask/entities/companies";
import {
  getCompanyStats,
  type CompanyStats,
} from "@/lib/autotask/entities/company-list";
import { contacts } from "@/lib/autotask/entities/contacts";
import { configurationItems } from "@/lib/autotask/entities/config-items";
import { contracts } from "@/lib/autotask/entities/contracts";
import {
  getTicketsPage,
  ticketSearchFilter,
} from "@/lib/autotask/entities/ticket-list";
import { getTicketPicklists } from "@/lib/autotask/entities/picklists";
import {
  getAssignableResources,
  type ResourceOption,
} from "@/lib/autotask/entities/resources";
import { AutotaskError, type AutotaskFilter } from "@/lib/autotask/client";
import { autotaskCompanyUrl } from "@/lib/autotask/links";
import { NewTicketDialog } from "@/components/tickets/new-ticket-dialog";
import { AutotaskOpenButton } from "@/components/autotask-open-button";
import { CompanyTabs } from "@/components/companies/company-tabs";
import {
  ContactsPanel,
  DevicesPanel,
  ContractsPanel,
} from "@/components/companies/kundenakte-panels";
import { TicketsList } from "@/components/tickets/tickets-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

// Gemeinsamer Kundenakte-Inhalt für die normale Seite (`/companies/[id]`, mit Sidebar)
// UND das Pop-out-Fenster (`/popup/companies/[id]`, ohne Sidebar). `basePath` lenkt die
// KPI-Kachel-Links auf die jeweilige Route (im Popup bleiben sie im Popup); die Tabs
// laufen über UrlTabs relativ zum aktuellen Pfad. `showBackLink` blendet im Popup den
// „Firmen"-Zurück-Link aus.

const VALID_TABS = [
  "offen",
  "abgeschlossen",
  "kontakte",
  "geraete",
  "vertraege",
] as const;
type Tab = (typeof VALID_TABS)[number];

function webHref(web: string): string {
  return /^https?:\/\//i.test(web) ? web : `https://${web}`;
}

export async function CompanyDetailContent({
  companyId,
  tabParam,
  cursor,
  q,
  basePath = "/companies",
  showBackLink = true,
}: {
  companyId: number;
  tabParam?: string;
  cursor?: string;
  q?: string;
  basePath?: string;
  showBackLink?: boolean;
}) {
  if (!Number.isFinite(companyId)) notFound();

  const session = await getSession();
  if (!session) return null;

  const tab: Tab = (VALID_TABS as readonly string[]).includes(tabParam ?? "")
    ? (tabParam as Tab)
    : "offen";

  let company;
  try {
    company = await companies.get(companyId);
  } catch (e) {
    return <LoadError entity="Firma" rateLimited={isRateLimited(e)} />;
  }
  if (!company) notFound();

  const [picklists, assignableResources] = await Promise.all([
    getTicketPicklists(),
    getAssignableResources(),
  ]);

  const addressLine = [
    company.address1,
    [company.postalCode, company.city].filter(Boolean).join(" "),
    company.state,
  ]
    .filter(Boolean)
    .join(", ");

  let panel: React.ReactNode;
  try {
    panel = await renderPanel(tab, companyId, cursor, q, picklists, {
      resources: assignableResources,
      myResourceId: session.autotaskResourceId,
    });
  } catch (e) {
    panel = <LoadError entity="Daten" rateLimited={isRateLimited(e)} />;
  }

  let stats: CompanyStats | null = null;
  try {
    stats = await getCompanyStats(companyId);
  } catch {
    stats = null;
  }

  return (
    <div className="flex flex-col gap-6">
      {showBackLink && (
        <Link
          href="/companies"
          /* Mobile gibt es den Zurück-Button schon in der Kopfzeile (HeaderBack);
             diesen Inline-Link daher nur auf Desktop zeigen – kein Doppel. */
          className="text-muted-foreground hover:text-foreground hidden items-center gap-1 text-sm md:inline-flex"
        >
          <ChevronLeftIcon className="size-4" />
          Firmen
        </Link>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {company.companyName ?? `Firma ${companyId}`}
          </h1>
          {addressLine || company.phone || company.webAddress ? (
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {addressLine ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPinIcon className="size-4 shrink-0" />
                  {addressLine}
                </span>
              ) : null}
              {company.phone ? (
                <span className="inline-flex items-center gap-1.5">
                  <PhoneIcon className="size-4 shrink-0" />
                  <span className="tabular-nums">{company.phone}</span>
                </span>
              ) : null}
              {company.webAddress ? (
                <span className="inline-flex items-center gap-1.5">
                  <GlobeIcon className="size-4 shrink-0" />
                  <a
                    href={webHref(company.webAddress)}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    {company.webAddress}
                  </a>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Desktop: voller Knopf. Mobile-Icon nur im Pop-out (sonst liefert ihn
              die App-Kopfzeile via HeaderAutotaskLink → kein Doppel). */}
          <AutotaskOpenButton
            href={autotaskCompanyUrl(companyId)}
            label="In Autotask öffnen"
            className="hidden md:inline-flex"
          />
          {basePath.startsWith("/popup") && (
            <AutotaskOpenButton
              href={autotaskCompanyUrl(companyId)}
              label="Autotask"
              /* gleiche Maße wie „Neues Ticket" (h-11 sm:h-7), da nebeneinander */
              className="h-11 sm:h-7 md:hidden"
            />
          )}
          <NewTicketDialog
            picklists={picklists}
            prefillCompany={{
              id: company.id,
              name: company.companyName ?? `Firma ${companyId}`,
            }}
            triggerLabel="Neues Ticket für diese Firma"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          title="Offene Tickets"
          value={stats?.openTickets ?? "—"}
          icon={TicketIcon}
          href={`${basePath}/${companyId}?tab=offen`}
        />
        <StatCard
          title="Abgeschlossen"
          value={stats?.closedTickets ?? "—"}
          icon={CircleCheckIcon}
          href={`${basePath}/${companyId}?tab=abgeschlossen`}
        />
        <StatCard
          title="Kontakte"
          value={stats?.contacts ?? "—"}
          icon={UsersIcon}
          href={`${basePath}/${companyId}?tab=kontakte`}
        />
        <StatCard
          title="Geräte"
          value={stats?.devices ?? "—"}
          icon={MonitorIcon}
          href={`${basePath}/${companyId}?tab=geraete`}
        />
        <StatCard
          title="Verträge"
          value={stats?.contracts ?? "—"}
          icon={FileTextIcon}
          href={`${basePath}/${companyId}?tab=vertraege`}
        />
      </div>

      <CompanyTabs active={tab}>{panel}</CompanyTabs>
    </div>
  );
}

// Dokumenttitel (Tab/Taskleiste des Popup-Fensters) = Firmenname.
export async function companyMetadata(id: number): Promise<Metadata> {
  if (!Number.isFinite(id)) return { title: "Firma" };
  try {
    const c = await companies.get(id);
    return { title: c?.companyName ?? `Firma #${id}` };
  } catch {
    return { title: `Firma #${id}` };
  }
}

async function renderPanel(
  tab: Tab,
  companyId: number,
  cursor: string | undefined,
  q: string | undefined,
  picklists: Awaited<ReturnType<typeof getTicketPicklists>>,
  bulk: { resources: ResourceOption[]; myResourceId: number },
): Promise<React.ReactNode> {
  if (tab === "offen" || tab === "abgeschlossen") {
    const filter: AutotaskFilter[] = [
      { op: "eq", field: "companyID", value: companyId },
    ];
    if (tab === "offen") {
      filter.push({ op: "noteq", field: "status", value: 5 });
    } else {
      filter.push({ op: "eq", field: "status", value: 5 });
    }
    filter.push(...ticketSearchFilter(q));
    const data = await getTicketsPage(filter, {
      cursorUrl: cursor,
      withAssigned: true,
    });
    return (
      <TicketsList
        data={data}
        picklists={picklists}
        filters={{ status: tab === "offen" ? "open" : "5", priority: "", queue: "" }}
        columns={{ assigned: true, company: false }}
        showFilters={false}
        showPager
        selectable
        resources={bulk.resources}
        myResourceId={bulk.myResourceId}
        emptyDescription={
          tab === "offen"
            ? "Diese Firma hat keine offenen Tickets."
            : "Diese Firma hat keine abgeschlossenen Tickets."
        }
      />
    );
  }

  if (tab === "kontakte") {
    const rows = await contacts.rowsByCompany(companyId);
    if (rows.length === 0) {
      return (
        <EmptyTab
          icon={<UsersIcon />}
          title="Keine Kontakte"
          description="Für diese Firma sind keine aktiven Kontakte hinterlegt."
        />
      );
    }
    return <ContactsPanel rows={rows} />;
  }

  if (tab === "geraete") {
    const rows = await configurationItems.rowsByCompany(companyId);
    if (rows.length === 0) {
      return (
        <EmptyTab
          icon={<MonitorIcon />}
          title="Keine Geräte"
          description="Für diese Firma sind keine Geräte erfasst."
        />
      );
    }
    return <DevicesPanel rows={rows} />;
  }

  const rows = await contracts.rowsByCompany(companyId);
  if (rows.length === 0) {
    return (
      <EmptyTab
        icon={<FileTextIcon />}
        title="Keine Verträge"
        description="Für diese Firma sind keine Verträge hinterlegt."
      />
    );
  }
  return <ContractsPanel rows={rows} />;
}

function EmptyTab({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  href,
}: {
  title: string;
  value: number | string;
  icon: LucideIcon;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card className="h-full transition-all group-hover:border-primary/40 group-hover:shadow-md motion-safe:group-hover:-translate-y-0.5">
        <CardHeader>
          <CardDescription>{title}</CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums">
            {value}
          </CardTitle>
          <CardAction>
            <Icon className="text-muted-foreground transition-colors group-hover:text-primary" />
          </CardAction>
        </CardHeader>
      </Card>
    </Link>
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
