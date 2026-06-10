import { AlertCircleIcon, ClockIcon } from "lucide-react";

import { getSession } from "@/lib/auth";
import { getMyTimeEntries, type TimeRange } from "@/lib/autotask/entities/my-time";
import { AutotaskError } from "@/lib/autotask/client";
import { formatHours } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { RangeToggle } from "@/components/time/range-toggle";
import { ZeitenTable } from "@/components/time/zeiten-table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
export const dynamic = "force-dynamic";

export default async function ZeitenPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  if (!session) return null; // Layout erzwingt bereits Login.

  const range: TimeRange = sp.range === "week" ? "week" : "today";

  try {
    const data = await getMyTimeEntries(session.autotaskResourceId, range);

    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Meine Zeiten"
          description="Deine erfassten Zeiten – heute oder in dieser Woche."
          actions={<RangeToggle range={range} />}
        />

        {/* Dezente Stat-Zeile statt KPI-Kacheln (konsistent mit dem Dashboard;
            spart auf dem Smartphone ~60% der ersten Bildschirmhöhe). */}
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span>
            Gesamt{" "}
            <span className="text-foreground font-semibold tabular-nums">
              {formatHours(data.totals.worked)}
            </span>
          </span>
          <span>
            Abrechenbar{" "}
            <span className="text-foreground font-semibold tabular-nums">
              {formatHours(data.totals.billable)}
            </span>
          </span>
          <span>
            Nicht abrechenbar{" "}
            <span className="text-foreground font-semibold tabular-nums">
              {formatHours(data.totals.nonBillable)}
            </span>
          </span>
        </div>

        {data.entries.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ClockIcon />
              </EmptyMedia>
              <EmptyTitle>Keine Zeiten erfasst</EmptyTitle>
              <EmptyDescription>
                {range === "today"
                  ? "Für heute hast du noch keine Zeiten erfasst."
                  : "Für diese Woche hast du noch keine Zeiten erfasst."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ZeitenTable rows={data.entries} />
        )}
      </div>
    );
  } catch (e) {
    const rateLimited = e instanceof AutotaskError && e.status === 429;
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>Zeiten konnten nicht geladen werden</AlertTitle>
        <AlertDescription>
          {rateLimited
            ? "Rate-Limit erreicht (429). Bitte kurz warten und erneut versuchen."
            : "Bitte später erneut versuchen."}
        </AlertDescription>
      </Alert>
    );
  }
}
