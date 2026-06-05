import "server-only";

import { timeEntries } from "@/lib/autotask/entities/time-entries";
import { tickets } from "@/lib/autotask/entities/tickets";
import type { TimeEntry } from "@/lib/autotask/types";

// „Meine Zeiten": eigene Zeiteinträge für heute / diese Woche, mit Summen und
// aufgelöstem Ticket (Nummer/Titel) + Tätigkeitsart. Rein lesend (V3).

export type TimeRange = "today" | "week";

export interface MyTimeRow extends TimeEntry {
  ticketNumber: string | null;
  ticketTitle: string | null;
  workTypeName: string | null;
}

export interface MyTimeTotals {
  worked: number;
  billable: number;
  nonBillable: number;
}

export interface MyTimeResult {
  range: TimeRange;
  entries: MyTimeRow[];
  totals: MyTimeTotals;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Lokales Kalenderdatum (Y-M-D) eines Date.
function localDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// UTC-Tagesgrenzen für einen Datums-Bereich (passt zu dateWorked = UTC-Mitternacht).
function utcBounds(fromDate: string, toDate: string): [string, string] {
  return [`${fromDate}T00:00:00.000Z`, `${toDate}T23:59:59.999Z`];
}

// Bereich heute bzw. aktuelle Woche (Mo–So, deutsche Konvention) als UTC-Grenzen.
function rangeBounds(range: TimeRange, now: Date): [string, string] {
  if (range === "today") {
    const t = localDate(now);
    return utcBounds(t, t);
  }
  const day = (now.getDay() + 6) % 7; // 0 = Montag … 6 = Sonntag
  const monday = new Date(now);
  monday.setDate(now.getDate() - day);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return utcBounds(localDate(monday), localDate(sunday));
}

export async function getMyTimeEntries(
  resourceId: number,
  range: TimeRange,
  now: Date = new Date(),
): Promise<MyTimeResult> {
  const [from, to] = rangeBounds(range, now);
  const entries = await timeEntries.byResourceBetween(resourceId, from, to);

  // Ticket-Nummern/Titel + Tätigkeitsarten gebündelt auflösen (kein N+1).
  const ticketIds = [
    ...new Set(
      entries
        .map((e) => e.ticketID)
        .filter((n): n is number => typeof n === "number"),
    ),
  ];

  const [ticketRows, workTypeList] = await Promise.all([
    ticketIds.length > 0
      ? tickets.query([{ op: "in", field: "id", value: ticketIds }], {
          fields: ["id", "ticketNumber", "title"],
          autoPage: false,
        })
      : Promise.resolve([]),
    timeEntries.workTypes().catch(() => []),
  ]);

  const ticketMap = new Map(ticketRows.map((t) => [t.id, t]));
  const workTypeMap = new Map(workTypeList.map((w) => [w.id, w.name]));

  const rows: MyTimeRow[] = entries
    .map((e) => {
      const t = e.ticketID != null ? ticketMap.get(e.ticketID) : undefined;
      return {
        ...e,
        ticketNumber: t?.ticketNumber ?? null,
        ticketTitle: t?.title ?? null,
        workTypeName:
          e.billingCodeID != null
            ? (workTypeMap.get(e.billingCodeID) ?? null)
            : null,
      };
    })
    .sort(
      (a, b) =>
        (Date.parse(b.dateWorked ?? "") || 0) -
        (Date.parse(a.dateWorked ?? "") || 0),
    );

  const worked = entries.reduce((s, e) => s + (e.hoursWorked ?? 0), 0);
  const billable = entries.reduce((s, e) => s + (e.hoursToBill ?? 0), 0);

  return {
    range,
    entries: rows,
    totals: { worked, billable, nonBillable: Math.max(0, worked - billable) },
  };
}
