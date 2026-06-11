import Link from "next/link";
import {
  AlertCircleIcon,
  FolderKanbanIcon,
  InboxIcon,
  ReplyIcon,
  TicketIcon,
  type LucideIcon,
} from "lucide-react";

import { getSession } from "@/lib/auth";
import {
  getDashboardKpis,
  getTicketsPerResource,
} from "@/lib/autotask/entities/dashboard";
import { getTicketsPage } from "@/lib/autotask/entities/ticket-list";
import { getSidebarTicketCounts } from "@/lib/autotask/entities/ticket-counts";
import { CountBarChart } from "@/components/dashboard/count-bar-chart";
import { getTicketPicklists } from "@/lib/autotask/entities/picklists";
import { AutotaskError, type AutotaskFilter } from "@/lib/autotask/client";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { OpenTickets } from "@/components/dashboard/open-tickets";
import { NewTicketDialog } from "@/components/tickets/new-ticket-dialog";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

function KpiCard({
  title,
  value,
  href,
  icon: Icon,
  accent,
  hint,
}: {
  title: string;
  value: number | string;
  href: string;
  icon: LucideIcon;
  accent?: boolean; // true -> destructive-Akzent (nur handlungsrelevante Kachel)
  hint?: string;
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
            <Icon
              className={
                accent
                  ? "text-destructive"
                  : "text-muted-foreground transition-colors group-hover:text-primary"
              }
            />
          </CardAction>
        </CardHeader>
        {/* Erklär-Unterzeile – IMMER gerendert und einzeilig (line-clamp-1), damit
            alle Kacheln auf jeder Breite exakt gleiche Struktur/Höhe haben. Fällt eine
            Kachel mal ohne Text aus, hält ein geschütztes Leerzeichen die Höhe. */}
        <CardContent className="text-muted-foreground line-clamp-1 text-xs">
          {hint ?? " "}
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;
  const rid = session.autotaskResourceId;

  // Erste Seite der offenen Tickets (team-weit, Status != Abgeschlossen=5) für den
  // initialen Server-Render; Filter („nur nicht zugewiesene") und Paging übernimmt
  // danach der Client-Abschnitt (OpenTickets) ohne Seiten-Neuladen.
  const openFilter: AutotaskFilter[] = [
    { op: "noteq", field: "status", value: 5 },
  ];

  const picklists = await getTicketPicklists();
  // Gesamtzahl offener Tickets (team-weit) für den Badge an der „Offene Tickets"-
  // Sektion. Gecacht, best effort.
  const counts = await getSidebarTicketCounts(rid).catch(() => null);

  // Datenabruf vom Rendern trennen: Fehler werden zu einem Sentinel, das JSX entsteht
  // AUSSERHALB von try/catch (React-19-Error-Boundary-Regel, kein JSX im try).
  const data = await Promise.all([
    getDashboardKpis(rid),
    getTicketsPerResource(),
    getTicketsPage(openFilter, { withAssigned: true }),
  ]).catch((e) =>
    e instanceof AutotaskError && e.status === 429
      ? ("rate-limited" as const)
      : ("error" as const),
  );

  if (data === "rate-limited" || data === "error") {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>Dashboard konnte nicht geladen werden</AlertTitle>
        <AlertDescription>
          {data === "rate-limited"
            ? "Rate-Limit erreicht (429). Bitte kurz warten und erneut versuchen."
            : "Bitte später erneut versuchen."}
        </AlertDescription>
      </Alert>
    );
  }

  const [kpis, perResource, openTickets] = data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Übersicht"
        description="Deine Tickets auf einen Blick."
        actions={<NewTicketDialog picklists={picklists} />}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Meine offenen Tickets"
          value={kpis.myOpen + kpis.secondaryOpen}
          href="/tickets/my"
          icon={TicketIcon}
          hint={
            kpis.secondaryOpen > 0
              ? `inkl. ${kpis.secondaryOpen} als zusätzlicher Mitarbeiter`
              : "Dir zugewiesene offene Tickets"
          }
        />
        <KpiCard
          title="Nicht zugewiesen"
          value={kpis.pool}
          href="/tickets/team?assigned=unassigned"
          icon={InboxIcon}
          hint="Offen, noch niemandem zugewiesen"
        />
        <KpiCard
          title="Meine Projekte"
          value={kpis.myProjects}
          href="/projekte"
          icon={FolderKanbanIcon}
          hint="Projekte, die du leitest oder bearbeitest"
        />
        <KpiCard
          title="Ball liegt bei mir"
          value={kpis.ballApprox ? `~${kpis.ballInMyCourt}` : kpis.ballInMyCourt}
          href="/tickets/ball"
          icon={ReplyIcon}
          accent
          hint={
            kpis.ballApprox
              ? "Kunde zuletzt aktiv (approximativ)"
              : "Kunde hat zuletzt geantwortet"
          }
        />
      </div>

      <CountBarChart title="Tickets pro Mitarbeiter" data={perResource} />

      <OpenTickets picklists={picklists} initial={openTickets} count={counts?.team} />
    </div>
  );
}
