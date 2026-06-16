import { ClockIcon } from "lucide-react";

import { getSession } from "@/lib/auth";
import { getMyTimeEntries, type TimeRange } from "@/lib/autotask/entities/my-time";
import { loadOrError } from "@/lib/data/load-or-error";
import { formatHours } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { RangeToggle } from "@/components/time/range-toggle";
import { ZeitenTable } from "@/components/time/zeiten-table";
import { DataError } from "@/components/data-error";
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

  const res = await loadOrError(() =>
    getMyTimeEntries(session.autotaskResourceId, range),
  );
  if (!res.ok)
    return (
      <DataError
        title="Zeiten konnten nicht geladen werden"
        rateLimited={res.rateLimited}
      />
    );
  const data = res.data;

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
}
