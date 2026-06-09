"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { TicketsList, type TicketRow } from "@/components/tickets/tickets-list";
import type { TicketPicklists } from "@/lib/autotask/types";
import type { RecentEditedCounts } from "@/lib/autotask/entities/dashboard";

type TimeWindow = "today" | "3" | "7";

const WINDOW_ITEMS = [
  { value: "today", label: "Heute" },
  { value: "3", label: "Letzte 3 Tage" },
  { value: "7", label: "Letzte 7 Tage" },
];

const SUBLABEL: Record<TimeWindow, string> = {
  today: "heute bearbeitet",
  "3": "in den letzten 3 Tagen bearbeitet",
  "7": "in den letzten 7 Tagen bearbeitet",
};

const nf = new Intl.NumberFormat("de-DE");

// Dashboard-Sektion „Bearbeitete Tickets": Management-Puls als große KPI-Zahl je
// Zeitfenster (springt beim Umschalten) + kompakte Liste der jüngsten Tickets als
// Kontext + „Alle ansehen" zum Drill-down. Die KPI kommt server-seitig aus dem
// Count-Endpoint (`counts`), die Liste aus dem 7-Tage-Fenster (clientseitig eingegrenzt).
export function RecentlyEdited({
  rows,
  counts,
  picklists,
}: {
  rows: TicketRow[];
  counts: RecentEditedCounts;
  picklists: TicketPicklists;
}) {
  const [win, setWin] = React.useState<TimeWindow>("today");

  const cutoff = React.useMemo(() => {
    const now = new Date();
    if (win === "today") {
      const midnight = new Date(now);
      midnight.setHours(0, 0, 0, 0);
      return midnight.getTime();
    }
    const days = win === "3" ? 3 : 7;
    return now.getTime() - days * 24 * 3600 * 1000;
  }, [win]);

  const items = React.useMemo(
    () =>
      rows
        .filter((t) => (Date.parse(t.lastActivityDate ?? "") || 0) >= cutoff)
        .slice(0, 10),
    [rows, cutoff],
  );

  const total = win === "today" ? counts.today : win === "3" ? counts.d3 : counts.d7;
  const listFilters = { status: "open", priority: "", queue: "" };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Bearbeitete Tickets</h2>
        <Select
          items={WINDOW_ITEMS}
          value={win}
          onValueChange={(v) => setWin(v as TimeWindow)}
        >
          <SelectTrigger size="sm" className="w-auto min-w-36" aria-label="Zeitraum">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {WINDOW_ITEMS.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">
          {nf.format(total)}
        </span>
        <span className="text-muted-foreground text-sm">{SUBLABEL[win]}</span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs font-medium">Neueste</span>
        <Button
          variant="link"
          size="sm"
          className="text-muted-foreground h-auto p-0"
          render={<Link href="/tickets/team" />}
        >
          Alle ansehen
          <ArrowRightIcon className="size-3.5" />
        </Button>
      </div>

      <TicketsList
        data={{ items, nextCursor: null, prevCursor: null }}
        picklists={picklists}
        filters={listFilters}
        columns={{ assigned: true }}
        showFilters={false}
        showPager={false}
        searchMode="off"
        emptyDescription={
          win === "today"
            ? "Heute wurde noch kein Ticket bearbeitet."
            : "Im gewählten Zeitraum wurde kein Ticket bearbeitet."
        }
      />
    </section>
  );
}
