"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { TicketCard } from "@/components/tickets/ticket-card";
import type { TicketRow } from "@/components/tickets/tickets-list";
import type { TicketPicklists } from "@/lib/autotask/types";
import type { RecentEditedCounts } from "@/lib/autotask/entities/dashboard";

const nf = new Intl.NumberFormat("de-DE");

// Dashboard-Sektion „Letzte Aktivität": zuletzt bewegte Tickets SYSTEMWEIT
// (nach lastActivityDate sortiert, letzte 7 Tage) – kein Bestands- oder
// „meine"-Filter. Aufbau bewusst ruhig: Überschrift + „Alle ansehen", eine
// dezente Stat-Zeile (statt großer KPI-Kacheln), darunter direkt die Liste der
// neuesten Vorgänge als gemeinsame TicketCard (variant="activity").
export function RecentlyEdited({
  rows,
  counts,
  picklists,
}: {
  rows: TicketRow[];
  counts: RecentEditedCounts;
  picklists: TicketPicklists;
}) {
  const items = rows.slice(0, 10);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Letzte Aktivität</h2>
        <Link
          href="/tickets/team"
          className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1 text-sm"
        >
          Alle ansehen
          <ArrowRightIcon className="size-3.5" />
        </Link>
      </div>

      {/* Dezente Stat-Zeile: ein ruhiger Puls statt dreier großer Zahlen-Kacheln. */}
      <p className="text-muted-foreground text-sm">
        <span className="text-foreground font-medium tabular-nums">
          {nf.format(counts.today)}
        </span>{" "}
        heute aktiv ·{" "}
        <span className="text-foreground font-medium tabular-nums">
          {nf.format(counts.d7)}
        </span>{" "}
        in 7 Tagen
      </p>

      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Keine Aktivität in den letzten 7 Tagen.
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
    </section>
  );
}
