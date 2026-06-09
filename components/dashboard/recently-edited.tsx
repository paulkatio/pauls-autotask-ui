"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { TicketCard } from "@/components/tickets/ticket-card";
import { cn } from "@/lib/utils";
import type { TicketRow } from "@/components/tickets/tickets-list";
import type { TicketPicklists } from "@/lib/autotask/types";
import type { RecentEditedCounts } from "@/lib/autotask/entities/dashboard";

type TimeWindow = "today" | "3" | "7";

const WINDOWS: { value: TimeWindow; label: string }[] = [
  { value: "today", label: "Heute" },
  { value: "3", label: "3 Tage" },
  { value: "7", label: "7 Tage" },
];

const nf = new Intl.NumberFormat("de-DE");

// Dashboard-Sektion „Bearbeitete Tickets": Header + „Alle ansehen", drei KPI-Segment-
// Tabs (Zahl + Zeitraum = zugleich Kennzahl UND Filter), darunter „Neueste Änderungen"
// als titel-zentrierte Liste. Zahlen kommen server-seitig aus dem Count-Endpoint
// (`counts`); die Liste aus dem 7-Tage-Fenster, clientseitig auf das Fenster eingegrenzt.
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

  const countFor = (w: TimeWindow) =>
    w === "today" ? counts.today : w === "3" ? counts.d3 : counts.d7;

  const cutoff = React.useMemo(() => {
    const now = new Date();
    if (win === "today") {
      const midnight = new Date(now);
      midnight.setHours(0, 0, 0, 0);
      return midnight.getTime();
    }
    return now.getTime() - (win === "3" ? 3 : 7) * 86400000;
  }, [win]);

  const items = React.useMemo(
    () =>
      rows
        .filter((t) => (Date.parse(t.lastActivityDate ?? "") || 0) >= cutoff)
        .slice(0, 10),
    [rows, cutoff],
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Bearbeitete Tickets</h2>
        <Link
          href="/tickets/team"
          className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1 text-sm"
        >
          Alle ansehen
          <ArrowRightIcon className="size-3.5" />
        </Link>
      </div>

      {/* KPI-Segment-Tabs: Zeitraum = Filter UND Kennzahl. */}
      <div className="grid grid-cols-3 gap-2">
        {WINDOWS.map((w) => {
          const active = win === w.value;
          return (
            <button
              key={w.value}
              type="button"
              onClick={() => setWin(w.value)}
              aria-pressed={active}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors outline-none",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3",
                active
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50 border-transparent bg-muted/40",
              )}
            >
              <span className="text-2xl font-semibold tabular-nums">
                {nf.format(countFor(w.value))}
              </span>
              <span className="text-muted-foreground text-xs">{w.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Neueste Änderungen
        </h3>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {win === "today"
              ? "Heute wurde noch kein Ticket bearbeitet."
              : "Im gewählten Zeitraum wurde kein Ticket bearbeitet."}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((t) => (
              <TicketCard
                key={t.id}
                ticket={t}
                picklists={picklists}
                variant="activity"
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
