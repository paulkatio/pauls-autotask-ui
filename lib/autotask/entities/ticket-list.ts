import "server-only";

import { tickets } from "@/lib/autotask/entities/tickets";
import { companies } from "@/lib/autotask/entities/companies";
import { resources } from "@/lib/autotask/entities/resources";
import type { AutotaskFilter } from "@/lib/autotask/client";
import type { Ticket } from "@/lib/autotask/types";

export interface TicketListRow extends Ticket {
  companyName: string | null;
  assignedResourceName?: string | null;
}

export interface TicketListPage {
  items: TicketListRow[];
  nextCursor: string | null;
  prevCursor: string | null;
}

// Textsuche in Ticketlisten (Paul-Feedback): Nummer ODER Titel enthält den Begriff.
// Leerer Begriff -> kein Filter. Wird von den Listenseiten in ihren Filter gemischt.
export function ticketSearchFilter(q?: string): AutotaskFilter[] {
  const term = (q ?? "").trim();
  if (!term) return [];
  return [
    {
      op: "or",
      items: [
        { op: "contains", field: "ticketNumber", value: term },
        { op: "contains", field: "title", value: term },
      ],
    },
  ];
}

// Zeitfenster-/Sortier-Helfer leben in einem reinen Modul (ohne server-only), damit
// der client-seitige TicketWindowSelect TICKET_WINDOW_DEFAULT importieren kann, ohne
// server-only-Code ins Bundle zu ziehen. Hier nur re-exportiert, damit die
// serverseitigen Aufrufer (Akten-Seiten) sie weiter aus einer Stelle beziehen.
export {
  type TicketWindow,
  TICKET_WINDOW_DEFAULT,
  normalizeTicketWindow,
  ticketWindowStartISO,
  ticketWindowFilter,
  sortByCreatedDesc,
} from "@/lib/autotask/ticket-window";

// Eine Listenseite (server-seitig gefiltert + gepaged) mit gebündelt aufgelösten
// Firmen- und (optional) Zugewiesen-Namen – kein N+1. Von "Meine Tickets" (B07)
// und "Teamtickets" (B12) gemeinsam genutzt.
export async function getTicketsPage(
  filter: AutotaskFilter[],
  opts: { cursorUrl?: string; withAssigned?: boolean; maxRecords?: number } = {},
): Promise<TicketListPage> {
  const page = await tickets.page(filter, {
    cursorUrl: opts.cursorUrl,
    maxRecords: opts.maxRecords ?? 25,
  });

  const companyIds = page.items
    .map((t) => t.companyID)
    .filter((n): n is number => typeof n === "number");
  const resourceIds = opts.withAssigned
    ? page.items
        .map((t) => t.assignedResourceID)
        .filter((n): n is number => typeof n === "number")
    : [];

  const [companyNames, resourceNames] = await Promise.all([
    companies.namesByIds(companyIds),
    opts.withAssigned
      ? resources.namesByIds(resourceIds)
      : Promise.resolve(new Map<number, string>()),
  ]);

  const items: TicketListRow[] = page.items.map((t) => ({
    ...t,
    companyName: t.companyID != null ? (companyNames.get(t.companyID) ?? null) : null,
    ...(opts.withAssigned
      ? {
          assignedResourceName:
            t.assignedResourceID != null
              ? (resourceNames.get(t.assignedResourceID) ?? null)
              : null,
        }
      : {}),
  }));

  return { items, nextCursor: page.nextPageUrl, prevCursor: page.prevPageUrl };
}

export interface TicketListAll {
  items: TicketListRow[];
  total: number;
  capped: boolean;
}

// Sicherheitsobergrenze: alle offenen Tickets in EINER langen Liste (kein Paging),
// aber gedeckelt, damit die Liste nicht unbegrenzt wächst (Autotask-Last/Render).
const TICKETS_ALL_CAP = 500;

// ALLE zur Filterbedingung passenden Tickets (keine Paginierung) – für „Meine
// Tickets" und „Teamtickets". Autotask liefert bis 500 pro Query; autoPage holt
// weitere Seiten bis zum Cap. `capped` zeigt an, dass die Obergrenze erreicht wurde.
export async function getTicketsAll(
  filter: AutotaskFilter[],
  opts: { withAssigned?: boolean; maxItems?: number } = {},
): Promise<TicketListAll> {
  const cap = opts.maxItems ?? TICKETS_ALL_CAP;
  const rows = await tickets.query(filter, { autoPage: true, maxItems: cap });

  const companyIds = rows
    .map((t) => t.companyID)
    .filter((n): n is number => typeof n === "number");
  const resourceIds = opts.withAssigned
    ? rows
        .map((t) => t.assignedResourceID)
        .filter((n): n is number => typeof n === "number")
    : [];

  const [companyNames, resourceNames] = await Promise.all([
    companies.namesByIds(companyIds),
    opts.withAssigned
      ? resources.namesByIds(resourceIds)
      : Promise.resolve(new Map<number, string>()),
  ]);

  const items: TicketListRow[] = rows.map((t) => ({
    ...t,
    companyName: t.companyID != null ? (companyNames.get(t.companyID) ?? null) : null,
    ...(opts.withAssigned
      ? {
          assignedResourceName:
            t.assignedResourceID != null
              ? (resourceNames.get(t.assignedResourceID) ?? null)
              : null,
        }
      : {}),
  }));

  return { items, total: items.length, capped: items.length >= cap };
}
