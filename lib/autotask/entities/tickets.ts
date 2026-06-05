import "server-only";

import { unstable_cache } from "next/cache";

import {
  autotask,
  type AutotaskFilter,
  type QueryOptions,
  type TicketPage,
} from "@/lib/autotask/client";
import type { Ticket } from "@/lib/autotask/types";
import { NOTIFY_UDF } from "@/lib/autotask/conversation";

// Dünner Wrapper für Tickets auf dem generischen Kern. Eine neue Entität =
// eine neue Datei dieser Art, kein Eingriff in den Kern (DECISIONS.md).

// Standard-Felder für Listen/Detail (alle in V5 verifiziert).
const TICKET_FIELDS: (keyof Ticket)[] = [
  "id",
  "ticketNumber",
  "title",
  "status",
  "priority",
  "queueID",
  "assignedResourceID",
  "assignedResourceRoleID",
  "companyID",
  "contactID",
  "createDate",
  "dueDateTime",
  "completedDate",
  "lastActivityDate",
];

// Offene Tickets (status != 5) gebündelt – nur companyID, für die Spalte
// "offene Tickets" der Firmenliste (B2): EIN Abruf, clientseitig nach companyID
// gruppiert (KEIN Count pro Firma). Cap 5000 (Stand 2026-06-04: 184 offene
// Tickets gesamt), 60 s gecacht.
const OPEN_BY_COMPANY_CAP = 5000;
const openCompanyCountsCached = unstable_cache(
  async (): Promise<{ counts: Record<number, number>; capped: boolean }> => {
    const rows = await autotask.query<Ticket>(
      "Tickets",
      {
        MaxRecords: 500,
        IncludeFields: ["id", "companyID"],
        Filter: [{ op: "noteq", field: "status", value: 5 }],
      },
      { maxItems: OPEN_BY_COMPANY_CAP },
    );
    const counts: Record<number, number> = {};
    for (const t of rows) {
      if (t.companyID != null) {
        counts[t.companyID] = (counts[t.companyID] ?? 0) + 1;
      }
    }
    return { counts, capped: rows.length >= OPEN_BY_COMPANY_CAP };
  },
  ["tickets-open-company-counts"],
  { revalidate: 60 },
);

export const tickets = {
  // Offene Tickets gruppiert nach companyID (gecacht, s. openCompanyCountsCached).
  openCompanyCounts: () => openCompanyCountsCached(),

  // Gefilterte Abfrage; IncludeFields defaulten auf TICKET_FIELDS.
  query(
    filter: AutotaskFilter[],
    opts: QueryOptions & { fields?: string[]; maxRecords?: number } = {},
  ): Promise<Ticket[]> {
    const { fields, maxRecords = 500, autoPage, maxItems } = opts;
    return autotask.query<Ticket>(
      "Tickets",
      {
        MaxRecords: maxRecords,
        IncludeFields: fields ?? (TICKET_FIELDS as string[]),
        Filter: filter,
      },
      { autoPage, maxItems },
    );
  },

  get(id: number): Promise<Ticket | null> {
    return autotask.get<Ticket>("Tickets", id);
  },

  // Neues Ticket anlegen (Top-Level POST Tickets, verifiziert 2026-06-04: itemId
  // 43181). Pflichtfelder laut entityInformation: companyID, priority, status,
  // title. `data` enthält nur die per Route gewhitelisteten Felder.
  create(data: Record<string, unknown>): Promise<number> {
    return autotask.create("Tickets", data);
  },

  // Hängt Text an das Ticket-Lösungsfeld (resolution) an (z. B. Zeiteintrag-
  // Zusammenfassung "an die Lösung anhängen"). resolution ist ein string (verifiziert).
  async appendResolution(id: number, text: string): Promise<void> {
    const t = await autotask.get<{ resolution?: string | null }>("Tickets", id);
    const existing = (t?.resolution ?? "").trim();
    const resolution = existing ? `${existing}\n${text}` : text;
    await autotask.update("Tickets", { id, resolution });
  },

  // Setzt das UDF "Kunde benachrichtigen" (steuert die Workflow-Mail).
  setNotify(id: number, on: boolean): Promise<number> {
    return autotask.update("Tickets", {
      id,
      userDefinedFields: [
        { name: NOTIFY_UDF.name, value: on ? NOTIFY_UDF.yes : NOTIFY_UDF.no },
      ],
    });
  },

  // Eine Seite gefiltert (server-seitiges Next/Prev). `cursorUrl` = von Autotask
  // gelieferte next/previous-URL; der Filter wird IMMER mitgesendet.
  page(
    filter: AutotaskFilter[],
    opts: { cursorUrl?: string; maxRecords?: number; fields?: string[] } = {},
  ): Promise<TicketPage<Ticket>> {
    const { cursorUrl, maxRecords = 25, fields } = opts;
    return autotask.queryPage<Ticket>(
      "Tickets",
      {
        MaxRecords: maxRecords,
        IncludeFields: fields ?? (TICKET_FIELDS as string[]),
        Filter: filter,
      },
      cursorUrl,
    );
  },
};
