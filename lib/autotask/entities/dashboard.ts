import "server-only";

import { unstable_cache } from "next/cache";

import { autotask, type AutotaskFilter } from "@/lib/autotask/client";
import { companies } from "@/lib/autotask/entities/companies";
import { resources } from "@/lib/autotask/entities/resources";
import type { Ticket } from "@/lib/autotask/types";
import {
  getTicketsPage,
  type TicketListPage,
  type TicketListRow,
} from "@/lib/autotask/entities/ticket-list";

const ME = (resourceId: number): AutotaskFilter => ({
  op: "eq",
  field: "assignedResourceID",
  value: resourceId,
});
const OPEN: AutotaskFilter = { op: "noteq", field: "status", value: 5 };
const UNASSIGNED: AutotaskFilter = { op: "notExist", field: "assignedResourceID" };

// "ball bei mir": meine offenen werden gedeckelt geladen; oberhalb = approximativ.
const BALL_FETCH_CAP = 500;
// `in`-Operator defensiv in Blöcken (vgl. B15: 139 IDs liefen, große Mengen splitten).
const IN_BLOCK = 300;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Die vier neuen Dashboard-Kacheln (B15). Quellen in DECISIONS.md verifiziert.
export interface DashboardKpis {
  myOpen: number; // K1
  pool: number; // K2
  secondaryOpen: number; // K3
  ballInMyCourt: number; // K4
  ballApprox: boolean; // K4: true, wenn das Fetch-Cap erreicht wurde
}

// K3 Schritt 1: alle ticketIDs, in denen rid zusätzlicher Mitarbeiter ist.
export async function getSecondaryTicketIds(resourceId: number): Promise<number[]> {
  const rows = await autotask.query<{ ticketID: number }>(
    "TicketSecondaryResources",
    {
      MaxRecords: 500,
      IncludeFields: ["ticketID"],
      Filter: [{ op: "eq", field: "resourceID", value: resourceId }],
    },
    { autoPage: true },
  );
  return [
    ...new Set(
      rows
        .map((r) => r.ticketID)
        .filter((n): n is number => typeof n === "number"),
    ),
  ];
}

// K3 Schritt 2: offene unter diesen IDs zählen – defensiv in Blöcken summiert.
async function countSecondaryOpen(resourceId: number): Promise<number> {
  const ids = await getSecondaryTicketIds(resourceId);
  if (ids.length === 0) return 0;
  const counts = await Promise.all(
    chunk(ids, IN_BLOCK).map((block) =>
      autotask.count("Tickets", [{ op: "in", field: "id", value: block }, OPEN]),
    ),
  );
  return counts.reduce((a, c) => a + c, 0);
}

// K4: meine offenen MIT lastActivityPersonType laden (gedeckelt), clientseitig
// === 2 (Contact) zählen. isQueryable:false -> kein Server-Count möglich (B15).
async function computeBall(
  resourceId: number,
): Promise<{ count: number; approx: boolean }> {
  const rows = await autotask.query<Ticket>(
    "Tickets",
    {
      MaxRecords: BALL_FETCH_CAP,
      IncludeFields: ["id", "lastActivityPersonType"],
      Filter: [ME(resourceId), OPEN],
    },
    { autoPage: false },
  );
  const count = rows.filter((t) => t.lastActivityPersonType === 2).length;
  return { count, approx: rows.length >= BALL_FETCH_CAP };
}

async function computeDashboardKpis(resourceId: number): Promise<DashboardKpis> {
  const me = ME(resourceId);
  const [myOpen, pool, secondaryOpen, ball] = await Promise.all([
    autotask.count("Tickets", [me, OPEN]),
    autotask.count("Tickets", [UNASSIGNED, OPEN]),
    countSecondaryOpen(resourceId),
    computeBall(resourceId),
  ]);
  return {
    myOpen,
    pool,
    secondaryOpen,
    ballInMyCourt: ball.count,
    ballApprox: ball.approx,
  };
}

// Alle vier Kacheln gecacht (revalidate 60 s) – Counts statt Vollabruf.
export function getDashboardKpis(resourceId: number): Promise<DashboardKpis> {
  return unstable_cache(
    () => computeDashboardKpis(resourceId),
    ["dashboard-kpis", String(resourceId)],
    { revalidate: 60 },
  )();
}

// Liste für K3 (Klickziel): offene Tickets, in denen rid Secondary ist.
export async function getSecondaryOpenTickets(
  resourceId: number,
  cursorUrl?: string,
): Promise<TicketListPage> {
  const ids = await getSecondaryTicketIds(resourceId);
  if (ids.length === 0) {
    return { items: [], nextCursor: null, prevCursor: null };
  }
  // Für die Liste defensiv auf einen Block deckeln (Edge-Case sehr großer Mengen).
  return getTicketsPage([{ op: "in", field: "id", value: ids.slice(0, IN_BLOCK) }, OPEN], {
    cursorUrl,
    withAssigned: true,
  });
}

// Liste für K4 (Klickziel): meine offenen, letzte Aktivität vom Kunden (=== 2).
// Gleiches ≤500-Approx-Muster wie "Zuletzt bearbeitet"; clientseitige Filterung.
export async function getBallInMyCourtTickets(
  resourceId: number,
): Promise<TicketListRow[]> {
  const rows = await autotask.query<Ticket>(
    "Tickets",
    {
      MaxRecords: BALL_FETCH_CAP,
      IncludeFields: [...RECENT_FIELDS, "lastActivityPersonType"],
      Filter: [ME(resourceId), OPEN],
    },
    { autoPage: false },
  );
  const mine = rows.filter((t) => t.lastActivityPersonType === 2);
  const names = await companies.namesByIds(
    mine
      .map((t) => t.companyID)
      .filter((n): n is number => typeof n === "number"),
  );
  return mine.map((t) => ({
    ...t,
    companyName: t.companyID != null ? (names.get(t.companyID) ?? null) : null,
  }));
}

export interface CountDatum {
  label: string;
  count: number;
  id?: number; // optionale Entitäts-ID (z. B. resourceID) für Klick-Navigation
}

// Team-Übersicht: offene Tickets je aktiver interner Resource (licenseType 1 =
// Mitarbeiter, keine API-User) über den Count-Endpoint. Namen aufgelöst,
// Null-Counts raus, absteigend, Top 15. Gecacht (60 s), KEIN Vollabruf.
async function computeTicketsPerResource(): Promise<CountDatum[]> {
  const resources = await autotask.query<{
    id: number;
    firstName?: string;
    lastName?: string;
  }>(
    "Resources",
    {
      MaxRecords: 200,
      IncludeFields: ["id", "firstName", "lastName"],
      Filter: [
        { op: "eq", field: "isActive", value: true },
        { op: "eq", field: "licenseType", value: 1 },
      ],
    },
    { autoPage: false },
  );
  const counts = await Promise.all(
    resources.map((r) =>
      autotask.count("Tickets", [
        { op: "eq", field: "assignedResourceID", value: r.id },
        OPEN,
      ]),
    ),
  );
  return resources
    .map((r, i) => ({
      id: r.id,
      label: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || `#${r.id}`,
      count: counts[i],
    }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 – kompakter, vermeidet gedrängte Balken.
}

export function getTicketsPerResource(): Promise<CountDatum[]> {
  return unstable_cache(computeTicketsPerResource, ["tickets-per-resource"], {
    revalidate: 60,
  })();
}

const RECENT_FIELDS = [
  "id",
  "ticketNumber",
  "title",
  "companyID",
  "assignedResourceID",
  "status",
  "priority",
  "dueDateTime",
  "lastActivityDate",
];

// 7 Tage = größtes Filterfenster der Dashboard-Liste („Heute / 3 / 7 Tage").
// Wir holen das volle 7-Tage-Fenster und lassen den Client je Auswahl eingrenzen.
const RECENT_WINDOW_DAYS = 7;

// "Zuletzt aktiv" über ALLE Tickets (auch fremde / nicht zugewiesene), nicht nur
// die eigenen. Serverseitiges Sortieren unterstützt Autotask NICHT (sort wird
// ignoriert). Daher per lastActivityDate-Fenster (letzte RECENT_WINDOW_DAYS Tage)
// eingrenzen, EINE Seite (≤500) holen, client-seitig nach lastActivityDate
// absteigend sortieren, Top N. Firmen- UND Zugewiesen-Namen gebündelt auflösen.
// limit = Obergrenze der zurückgegebenen Zeilen (der Client filtert daraus nach
// Heute/3/7 Tagen). Großzügig (50), damit „Heute" auch bei viel Aktivität reicht.
export async function getRecentlyEdited(limit = 50): Promise<TicketListRow[]> {
  const since = new Date(
    Date.now() - RECENT_WINDOW_DAYS * 24 * 3600 * 1000,
  ).toISOString();
  const rows = await autotask.query<Ticket>(
    "Tickets",
    {
      MaxRecords: 500,
      IncludeFields: RECENT_FIELDS,
      Filter: [{ op: "gte", field: "lastActivityDate", value: since }],
    },
    { autoPage: false },
  );
  const sorted = [...rows]
    .sort(
      (a, b) =>
        (Date.parse(b.lastActivityDate ?? "") || 0) -
        (Date.parse(a.lastActivityDate ?? "") || 0),
    )
    .slice(0, limit);

  const [companyNames, resourceNames] = await Promise.all([
    companies.namesByIds(
      sorted
        .map((t) => t.companyID)
        .filter((n): n is number => typeof n === "number"),
    ),
    resources.namesByIds(
      sorted
        .map((t) => t.assignedResourceID)
        .filter((n): n is number => typeof n === "number"),
    ),
  ]);

  return sorted.map((t) => ({
    ...t,
    companyName:
      t.companyID != null ? (companyNames.get(t.companyID) ?? null) : null,
    assignedResourceName:
      t.assignedResourceID != null
        ? (resourceNames.get(t.assignedResourceID) ?? null)
        : null,
  }));
}
