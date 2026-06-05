import "server-only";

import { autotask, type AutotaskFilter } from "@/lib/autotask/client";
import { tickets } from "@/lib/autotask/entities/tickets";
import { companies } from "@/lib/autotask/entities/companies";
import {
  getTicketsPage,
  type TicketListPage,
} from "@/lib/autotask/entities/ticket-list";

const EMPTY: TicketListPage = { items: [], nextCursor: null, prevCursor: null };

// Schlanke, auf EIN Feld begrenzte Ticketsuche für die Spotlight-Spalten
// (Ticket-Name = title, Ticket-Nummer = ticketNumber). Ohne Firmennamen-Auflösung
// (spart zusätzliche Companies-Abfragen) → schont das Rate-Limit.
export interface QuickTicket {
  id: number;
  ticketNumber: string | null;
  title: string | null;
}

export async function quickTicketSearch(
  query: string,
  field: "title" | "ticketNumber",
  limit = 8,
): Promise<QuickTicket[]> {
  const q = query.trim();
  if (!q) return [];
  const rows = await tickets.query(
    [{ op: "contains", field, value: q }],
    { fields: ["id", "ticketNumber", "title"], maxRecords: limit, autoPage: false },
  );
  return rows.map((r) => ({
    id: r.id,
    ticketNumber: r.ticketNumber ?? null,
    title: r.title ?? null,
  }));
}

// Sieht die Eingabe wie eine Ticketnummer aus? (Muster T20… / T<Ziffern>)
function looksLikeTicketNumber(q: string): boolean {
  return /^t\s*\d/i.test(q.trim());
}

async function companyIdsByName(q: string): Promise<number[]> {
  const rows = await autotask.query<{ id: number }>(
    "Companies",
    {
      MaxRecords: 25,
      IncludeFields: ["id"],
      Filter: [{ op: "contains", field: "companyName", value: q }],
    },
    { autoPage: false },
  );
  return rows.map((r) => r.id);
}

async function contactIdsByName(q: string): Promise<number[]> {
  const rows = await autotask.query<{ id: number }>(
    "Contacts",
    {
      MaxRecords: 25,
      IncludeFields: ["id"],
      Filter: [
        {
          op: "or",
          items: [
            { op: "contains", field: "firstName", value: q },
            { op: "contains", field: "lastName", value: q },
          ],
        },
      ],
    },
    { autoPage: false },
  );
  return rows.map((r) => r.id);
}

// Ticketsuche: Nummer-Muster → ticketNumber; sonst Titel contains + (zwei-Schritt)
// Firma/Kontakt-Name → companyID/contactID in […]. Alles in EINER OR-Gruppe
// (Operator "or" verifiziert). Begrenzte Treffermenge, kein Auto-Paging.
export async function searchTickets(query: string): Promise<TicketListPage> {
  const q = query.trim();
  if (!q) return EMPTY;

  let orItems: AutotaskFilter[];
  if (looksLikeTicketNumber(q)) {
    orItems = [{ op: "contains", field: "ticketNumber", value: q }];
  } else {
    orItems = [{ op: "contains", field: "title", value: q }];
    const [companyIds, contactIds] = await Promise.all([
      companyIdsByName(q),
      contactIdsByName(q),
    ]);
    if (companyIds.length > 0) {
      orItems.push({ op: "in", field: "companyID", value: companyIds });
    }
    if (contactIds.length > 0) {
      orItems.push({ op: "in", field: "contactID", value: contactIds });
    }
  }

  return getTicketsPage([{ op: "or", items: orItems }], { maxRecords: 50 });
}

// --- Paginierte Spalten für die /search-Seite (Cursor-Token + Gesamtzahl) ----------
// Eine Spalte = eine Entität/ein Feld; lädt seitenweise (queryPageToken → opaker
// Token, keine Autotask-URL zum Browser). `total` nur auf der ERSTEN Seite (token leer).
export type SearchKind = "firma" | "kontakt" | "ticket-name" | "ticket-nummer";

export interface SearchColumnItem {
  key: string;
  href: string;
  primary: string;
  secondary: string | null;
}

export interface SearchColumnResult {
  items: SearchColumnItem[];
  nextToken: string | null;
  total: number | null;
}

const SEARCH_PAGE = 25;

export async function searchColumnPage(
  kind: SearchKind,
  query: string,
  token?: string,
): Promise<SearchColumnResult> {
  const q = query.trim();
  if (!q) return { items: [], nextToken: null, total: 0 };
  const first = token == null || token === "";

  if (kind === "firma") {
    const filter: AutotaskFilter[] = [
      { op: "contains", field: "companyName", value: q },
      { op: "eq", field: "isActive", value: true },
    ];
    const [page, total] = await Promise.all([
      autotask.queryPageToken<{ id: number; companyName?: string; city?: string }>(
        "Companies",
        {
          MaxRecords: SEARCH_PAGE,
          IncludeFields: ["id", "companyName", "city"],
          Filter: filter,
        },
        token,
      ),
      first ? autotask.count("Companies", filter) : Promise.resolve(null),
    ]);
    return {
      items: page.items.map((c) => ({
        key: `co-${c.id}`,
        href: `/companies/${c.id}`,
        primary: c.companyName ?? `#${c.id}`,
        secondary: c.city || null,
      })),
      nextToken: page.nextToken,
      total,
    };
  }

  if (kind === "kontakt") {
    const filter: AutotaskFilter[] = [
      {
        op: "or",
        items: [
          { op: "contains", field: "firstName", value: q },
          { op: "contains", field: "lastName", value: q },
        ],
      },
      { op: "eq", field: "isActive", value: true },
    ];
    const [page, total] = await Promise.all([
      autotask.queryPageToken<{
        id: number;
        firstName?: string;
        lastName?: string;
        companyID?: number;
      }>(
        "Contacts",
        {
          MaxRecords: SEARCH_PAGE,
          IncludeFields: ["id", "firstName", "lastName", "companyID"],
          Filter: filter,
        },
        token,
      ),
      first ? autotask.count("Contacts", filter) : Promise.resolve(null),
    ]);
    const names = await companies.namesByIds(
      page.items
        .map((c) => c.companyID)
        .filter((n): n is number => typeof n === "number"),
    );
    return {
      items: page.items.map((c) => ({
        key: `ct-${c.id}`,
        href: `/contacts/${c.id}`,
        primary: `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || `#${c.id}`,
        secondary: c.companyID != null ? (names.get(c.companyID) ?? null) : null,
      })),
      nextToken: page.nextToken,
      total,
    };
  }

  // ticket-name | ticket-nummer
  const field = kind === "ticket-name" ? "title" : "ticketNumber";
  const filter: AutotaskFilter[] = [{ op: "contains", field, value: q }];
  const [page, total] = await Promise.all([
    autotask.queryPageToken<{ id: number; ticketNumber?: string; title?: string }>(
      "Tickets",
      {
        MaxRecords: SEARCH_PAGE,
        IncludeFields: ["id", "ticketNumber", "title"],
        Filter: filter,
      },
      token,
    ),
    first ? autotask.count("Tickets", filter) : Promise.resolve(null),
  ]);
  return {
    items: page.items.map((t) =>
      kind === "ticket-name"
        ? {
            key: `tn-${t.id}`,
            href: `/tickets/${t.id}`,
            primary: t.title ?? t.ticketNumber ?? `Ticket ${t.id}`,
            secondary: t.ticketNumber ?? null,
          }
        : {
            key: `tnr-${t.id}`,
            href: `/tickets/${t.id}`,
            primary: t.ticketNumber ?? `Ticket ${t.id}`,
            secondary: t.title ?? null,
          },
    ),
    nextToken: page.nextToken,
    total,
  };
}
