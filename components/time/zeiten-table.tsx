"use client";

import Link from "next/link";
import { ClockIcon } from "lucide-react";

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
      emptyIcon={<ClockIcon />}
      emptyTitle="Keine Zeiten"
      emptyDescription="Keine Zeiteinträge im gewählten Zeitraum."
      columns={[
        {
          key: "date",
          header: "Datum",
          cell: (r) => fmtDate(r.dateWorked),
          cellClassName:
            "text-muted-foreground tabular-nums whitespace-nowrap",
        },
        {
          key: "ticket",
          header: "Ticket",
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
          cell: (r) => formatHours(r.hoursWorked),
          headClassName: "text-right",
          cellClassName: "text-right font-medium tabular-nums whitespace-nowrap",
        },
        {
          key: "bill",
          header: "Abrechenbar",
          cell: (r) => formatHours(r.hoursToBill),
          headClassName: "text-right",
          cellClassName:
            "text-right text-muted-foreground tabular-nums whitespace-nowrap",
        },
      ]}
    />
  );
}
