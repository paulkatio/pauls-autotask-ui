"use client";

import Link from "next/link";
import { Clock } from "@phosphor-icons/react/ssr";

import { Badge } from "@/components/ui/badge";
import { SearchableTable } from "@/components/searchable-table";
import { TruncatedText } from "@/components/truncated-text";
import { formatHours } from "@/lib/format";

export interface ZeitenRow {
  id: number;
  dateWorked?: string;
  ticketID?: number | null;
  ticketTitle?: string | null;
  ticketNumber?: string | null;
  workTypeName?: string | null;
  hoursWorked?: number;
  hoursToBill?: number;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(d);
}

function dateSort(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

// „Meine Zeiten" als durchsuchbare Tabelle (Paul-Feedback: jede Liste braucht eine
// Suche; Spaltenbreiten automatisch).
export function ZeitenTable({ rows }: { rows: ZeitenRow[] }) {
  return (
    <SearchableTable
      rows={rows}
      storageKey="cols:zeiten"
      searchText={(r) =>
        `${r.ticketNumber ?? ""} ${r.ticketTitle ?? ""} ${r.workTypeName ?? ""}`
      }
      searchPlaceholder="Ticket oder Tätigkeit suchen …"
      mobileCard={(r) => (
        <>
          <div className="flex items-baseline justify-between gap-2">
            {r.ticketID != null ? (
              <Link
                href={`/tickets/${r.ticketID}`}
                className="min-w-0 text-sm font-medium break-words hover:underline"
              >
                {r.ticketTitle ?? r.ticketNumber ?? `Ticket ${r.ticketID}`}
              </Link>
            ) : (
              <span className="text-sm font-medium break-words">
                {r.ticketTitle ?? "—"}
              </span>
            )}
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {fmtDate(r.dateWorked)}
            </span>
          </div>
          {r.ticketNumber && (
            <span className="text-muted-foreground text-xs tabular-nums">
              {r.ticketNumber}
            </span>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {r.workTypeName ? (
              <Badge variant="secondary">{r.workTypeName}</Badge>
            ) : (
              <span className="text-muted-foreground text-sm">—</span>
            )}
            <span className="text-sm tabular-nums">
              {formatHours(r.hoursWorked)}
              <span className="text-muted-foreground">
                {" "}
                · abr. {formatHours(r.hoursToBill)}
              </span>
            </span>
          </div>
        </>
      )}
      emptyIcon={<Clock />}
      emptyTitle="Keine Zeiten"
      emptyDescription="Keine Zeiteinträge im gewählten Zeitraum."
      columns={[
        {
          key: "date",
          header: "Datum",
          sortValue: (r) => dateSort(r.dateWorked),
          cell: (r) => fmtDate(r.dateWorked),
          cellClassName:
            "text-muted-foreground tabular-nums whitespace-nowrap",
        },
        {
          key: "ticket",
          header: "Ticket",
          sortValue: (r) => r.ticketTitle ?? r.ticketNumber ?? "",
          cell: (r) =>
            r.ticketID != null ? (
              <Link
                href={`/tickets/${r.ticketID}`}
                className="flex min-w-0 flex-col hover:underline"
              >
                <TruncatedText className="max-w-xs">
                  {r.ticketTitle ?? r.ticketNumber ?? `Ticket ${r.ticketID}`}
                </TruncatedText>
                {r.ticketNumber && (
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {r.ticketNumber}
                  </span>
                )}
              </Link>
            ) : (
              "—"
            ),
        },
        {
          key: "activity",
          header: "Tätigkeit",
          sortValue: (r) => r.workTypeName ?? "",
          cell: (r) =>
            r.workTypeName ? (
              <Badge variant="secondary">{r.workTypeName}</Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        },
        {
          key: "dauer",
          header: "Dauer",
          sortValue: (r) => r.hoursWorked ?? null,
          cell: (r) => formatHours(r.hoursWorked),
          headClassName: "text-right",
          cellClassName: "text-right font-medium tabular-nums whitespace-nowrap",
        },
        {
          key: "bill",
          header: "Abrechenbar",
          sortValue: (r) => r.hoursToBill ?? null,
          cell: (r) => formatHours(r.hoursToBill),
          headClassName: "text-right",
          cellClassName:
            "text-right text-muted-foreground tabular-nums whitespace-nowrap",
        },
      ]}
    />
  );
}
