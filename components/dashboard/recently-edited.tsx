"use client";

import * as React from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TicketsList, type TicketRow } from "@/components/tickets/tickets-list";
import type { TicketPicklists } from "@/lib/autotask/types";

type TimeWindow = "today" | "3" | "7";

const HEADINGS: Record<TimeWindow, string> = {
  today: "Heute bearbeitet",
  "3": "Letzte 3 Tage",
  "7": "Letzte 7 Tage",
};

// Dashboard-Liste „bearbeitete Tickets" mit Zeitfenster-Umschalter (Heute / letzte
// 3 / letzte 7 Tage, Default Heute). Die Zeilen kommen serverseitig aus dem 7-Tage-
// Fenster (nach lastActivityDate sortiert); hier nur clientseitig eingrenzen.
export function RecentlyEdited({
  rows,
  picklists,
}: {
  rows: TicketRow[];
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

  const listFilters = { status: "open", priority: "", queue: "" };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">{HEADINGS[win]}</h2>
        <Select value={win} onValueChange={(v) => setWin(v as TimeWindow)}>
          <SelectTrigger size="sm" className="w-auto min-w-36" aria-label="Zeitraum">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="today">Heute</SelectItem>
              <SelectItem value="3">Letzte 3 Tage</SelectItem>
              <SelectItem value="7">Letzte 7 Tage</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
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
