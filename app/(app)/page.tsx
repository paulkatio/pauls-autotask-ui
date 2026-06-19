import Link from "next/link";
import {
  WarningCircle,
  Kanban,
  UserCircleDashed,
  ArrowBendUpLeft,
  Ticket,
} from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";

import { getSession } from "@/lib/auth";
import {
  getDashboardKpis,
  getTicketsPerResource,
} from "@/lib/autotask/entities/dashboard";
import { getMyProjectsPreview } from "@/lib/autotask/entities/projects";
import { MyProjectsSection } from "@/components/dashboard/my-projects-section";
import { getTicketsPage } from "@/lib/autotask/entities/ticket-list";
import { getSidebarTicketCounts } from "@/lib/autotask/entities/ticket-counts";
import { getAssignableResources } from "@/lib/autotask/entities/resources";
import { CountBarChart } from "@/components/dashboard/count-bar-chart";
import { getTicketPicklists } from "@/lib/autotask/entities/picklists";
import { AutotaskError, type AutotaskFilter } from "@/lib/autotask/client";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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
  icon: Icon;
  accent?: boolean; // true -> destructive-Akzent (nur handlungsrelevante Kachel)
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="group block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {/* Container-Query-Kachel: reagiert auf die eigene KACHELbreite (nicht den
          Viewport) -> einheitlich auf jeder Bildschirmgroesse.
          - schmal (Handy, 2-spaltig): Zahl oben, Titel + Hinweis darunter
          - ab ~13rem Kachelbreite (Tablet/Desktop): Zahl links, Text rechts ->
            fuellt die Breite (kein Leerraum), bleibt aber flach.
          Titel + Hinweis einzeilig (truncate) -> alle Kacheln exakt gleich hoch. */}
      <Card className="@container relative h-full justify-center transition-all group-hover:shadow-md group-hover:ring-foreground/20 motion-safe:group-hover:-translate-y-0.5">
        <Icon
          aria-hidden
          className={cn(
            "absolute top-4 right-4 size-5 shrink-0 transition-colors",
            accent
              ? "text-destructive"
              : "text-muted-foreground group-hover:text-primary",
          )}
        />
        <div className="flex flex-col gap-1 px-4 @min-[13rem]:flex-row @min-[13rem]:items-center @min-[13rem]:gap-4">
          <span className="text-3xl leading-none font-semibold tabular-nums @min-[13rem]:shrink-0">
            {value}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5 pr-6 @min-[13rem]:flex-1">
            <span className="truncate text-sm font-medium">{title}</span>
            {/* Einzeiliger Hinweis; geschuetztes Leerzeichen haelt die Hoehe, falls leer. */}
            <span className="text-muted-foreground truncate text-xs">
              {hint ?? " "}
            </span>
          </div>
        </div>
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
  // Mitarbeiter für die Bulk-Aktionen der „Offene Tickets"-Liste (Zuweisen).
  // Best effort: scheitert der Abruf, bleibt die Liste read-only statt zu kippen.
  const assignableResources = await getAssignableResources().catch(() => []);

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
        <WarningCircle />
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

  // Vorschau „Meine Projekte" – best effort, aus derselben gecachten Quelle wie die
  // KPI-Kachel (kein zusätzlicher Collect). Ein Projektfehler darf die Übersicht nicht
  // blanken, daher eigener Fallback.
  const projectsPreview = await getMyProjectsPreview(rid).catch(() => ({
    count: 0,
    items: [],
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Übersicht"
        description="Deine Tickets auf einen Blick."
        actions={<NewTicketDialog picklists={picklists} />}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Meine Tickets"
          value={kpis.myOpen + kpis.secondaryOpen}
          href="/tickets/my"
          icon={Ticket}
          hint={
            kpis.secondaryOpen > 0
              ? `inkl. ${kpis.secondaryOpen} zusätzlich`
              : "Dir zugewiesen, offen"
          }
        />
        <KpiCard
          title="Nicht zugewiesen"
          value={kpis.pool}
          href="/tickets/team?assigned=unassigned"
          icon={UserCircleDashed}
          hint="Wartet auf einen Bearbeiter"
        />
        <KpiCard
          title="Meine Projekte"
          value={kpis.myProjects}
          href="/projekte"
          icon={Kanban}
          hint="Geleitet oder bearbeitet"
        />
        <KpiCard
          title="Ball liegt bei mir"
          value={kpis.ballApprox ? `~${kpis.ballInMyCourt}` : kpis.ballInMyCourt}
          href="/tickets/ball"
          icon={ArrowBendUpLeft}
          accent
          hint={kpis.ballApprox ? "Kunde zuletzt aktiv (ca.)" : "Kunde hat geantwortet"}
        />
      </div>

      {/* Ab lg: 4-Spalten-Grid analog zum KPI-Raster darüber. Chart = 3/4
          (col-span-3), Projekte = 1/4. FESTE Zeilenhöhe (lg:h-[23rem]) auf beiden
          Spalten = der Höhenbedarf des Diagramms (Kopf + Plot + Achse). So ist die
          Zeile NIE höher als das Diagramm; die Projektliste wird darin abgeschnitten
          und scrollt intern, egal wie viele Projekte (Paul-Feedback). Unter lg
          gestapelt/voll breit (natürliche Höhe). */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="lg:col-span-3 lg:h-[23rem]">
          <CountBarChart title="Tickets pro Mitarbeiter" data={perResource} />
        </div>
        <div className="lg:h-[23rem]">
          <MyProjectsSection preview={projectsPreview} />
        </div>
      </div>

      <OpenTickets
        picklists={picklists}
        initial={openTickets}
        count={counts?.team}
        resources={assignableResources}
        myResourceId={rid}
      />
    </div>
  );
}
