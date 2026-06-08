import Link from "next/link";
import {
  AlertCircleIcon,
  InboxIcon,
  ReplyIcon,
  TicketIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

import { getSession } from "@/lib/auth";
import {
  getDashboardKpis,
  getRecentlyEdited,
  getTicketsPerResource,
} from "@/lib/autotask/entities/dashboard";
import { CountBarChart } from "@/components/dashboard/count-bar-chart";
import { getTicketPicklists } from "@/lib/autotask/entities/picklists";
import { AutotaskError } from "@/lib/autotask/client";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { RecentlyEdited } from "@/components/dashboard/recently-edited";
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
        {hint && (
          <CardContent className="text-muted-foreground text-xs">{hint}</CardContent>
        )}
      </Card>
    </Link>
  );
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;
  const rid = session.autotaskResourceId;

  const picklists = await getTicketPicklists();

  try {
    const [kpis, recent, perResource] = await Promise.all([
      getDashboardKpis(rid),
      getRecentlyEdited(),
      getTicketsPerResource(),
    ]);

    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Übersicht"
          description="Deine Tickets auf einen Blick."
        />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            title="Meine offenen Tickets"
            value={kpis.myOpen}
            href="/tickets/my"
            icon={TicketIcon}
          />
          <KpiCard
            title="Nicht zugewiesen (Pool)"
            value={kpis.pool}
            href="/tickets/team?assigned=unassigned"
            icon={InboxIcon}
          />
          <KpiCard
            title="Zusätzlicher Mitarbeiter"
            value={kpis.secondaryOpen}
            href="/tickets/secondary"
            icon={UsersIcon}
          />
          <KpiCard
            title="Ball liegt bei mir"
            value={kpis.ballApprox ? `~${kpis.ballInMyCourt}` : kpis.ballInMyCourt}
            href="/tickets/ball"
            icon={ReplyIcon}
            accent
            hint={
              kpis.ballApprox
                ? "approximativ (Obergrenze erreicht)"
                : undefined
            }
          />
        </div>

        <CountBarChart title="Tickets pro Mitarbeiter" data={perResource} />

        <RecentlyEdited rows={recent} picklists={picklists} />
      </div>
    );
  } catch (e) {
    const rateLimited = e instanceof AutotaskError && e.status === 429;
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>Dashboard konnte nicht geladen werden</AlertTitle>
        <AlertDescription>
          {rateLimited
            ? "Rate-Limit erreicht (429). Bitte kurz warten und erneut versuchen."
            : "Bitte später erneut versuchen."}
        </AlertDescription>
      </Alert>
    );
  }
}
