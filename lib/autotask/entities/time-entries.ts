import "server-only";

import { autotask } from "@/lib/autotask/client";
import type { TimeEntry } from "@/lib/autotask/types";

const TIME_ENTRY_FIELDS = [
  "id",
  "ticketID",
  "resourceID",
  "roleID",
  "dateWorked",
  "startDateTime",
  "endDateTime",
  "hoursWorked",
  "hoursToBill",
  "billingCodeID",
  "summaryNotes",
  "internalNotes",
  "isNonBillable",
];

export interface ResourceRoleOption {
  roleID: number;
  name: string;
}

export interface WorkType {
  id: number;
  name: string;
}

export interface TimeEntryInput {
  resourceId: number;
  roleId: number;
  billingCodeId?: number;
  startDateTime: string; // ISO
  endDateTime: string; // ISO
  hoursWorked: number;
  summaryNotes?: string;
}

export const timeEntries = {
  // Zeiteinträge eines Tickets (read).
  byTicket: (ticketId: number): Promise<TimeEntry[]> =>
    autotask.query<TimeEntry>("TimeEntries", {
      MaxRecords: 500,
      IncludeFields: TIME_ENTRY_FIELDS,
      Filter: [{ op: "eq", field: "ticketID", value: ticketId }],
    }),

  // Zeiteinträge einer Resource in einem Zeitraum (read; „Meine Zeiten").
  // `dateWorked` wird in Autotask als UTC-Mitternacht gespeichert (verifiziert
  // 2026-06-04) → Bereichsgrenzen entsprechend als UTC-Tagesgrenzen übergeben.
  byResourceBetween: (
    resourceId: number,
    fromIso: string,
    toIso: string,
  ): Promise<TimeEntry[]> =>
    autotask.query<TimeEntry>("TimeEntries", {
      MaxRecords: 500,
      IncludeFields: TIME_ENTRY_FIELDS,
      Filter: [
        { op: "eq", field: "resourceID", value: resourceId },
        { op: "gte", field: "dateWorked", value: fromIso },
        { op: "lte", field: "dateWorked", value: toIso },
      ],
    }),

  // Rollen, die eine Resource tatsächlich hält (roleID ist bei Ticket-Zeiten
  // Pflicht und muss eine gehaltene Rolle sein, DECISIONS V3 / 2026-06-03).
  // Namen aus der Entität Roles aufgelöst; Duplikate raus.
  async rolesForResource(resourceId: number): Promise<ResourceRoleOption[]> {
    const rows = await autotask.query<{ roleID?: number }>(
      "ResourceRoles",
      {
        MaxRecords: 100,
        IncludeFields: ["resourceID", "roleID", "isActive"],
        Filter: [
          { op: "eq", field: "resourceID", value: resourceId },
          { op: "eq", field: "isActive", value: true },
        ],
      },
      { autoPage: false },
    );
    const ids = [
      ...new Set(
        rows
          .map((r) => r.roleID)
          .filter((n): n is number => typeof n === "number"),
      ),
    ];
    if (ids.length === 0) return [];
    const roles = await autotask.query<{ id: number; name?: string }>(
      "Roles",
      {
        MaxRecords: 500,
        IncludeFields: ["id", "name"],
        Filter: [{ op: "in", field: "id", value: ids }],
      },
      { autoPage: false },
    );
    const names = new Map(roles.map((r) => [r.id, r.name]));
    return ids.map((id) => ({ roleID: id, name: names.get(id) ?? `Rolle #${id}` }));
  },

  // Tätigkeitsarten (Work Types) = BillingCodes mit useType 1 (verifiziert
  // 2026-06-03; enthält u. a. „Remote-Support"). Nur aktive, nach Name sortiert.
  async workTypes(): Promise<WorkType[]> {
    const rows = await autotask.query<{ id: number; name?: string }>(
      "BillingCodes",
      {
        MaxRecords: 200,
        IncludeFields: ["id", "name", "useType", "isActive"],
        Filter: [
          { op: "eq", field: "isActive", value: true },
          { op: "eq", field: "useType", value: 1 },
        ],
      },
      { autoPage: false },
    );
    return rows
      .map((r) => ({ id: r.id, name: r.name ?? `#${r.id}` }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  },

  // Zeiteintrag anlegen. Service-Tickets verlangen start+stop; wir senden immer
  // start/end + berechnete hoursWorked (deckt alle Ticketarten ab).
  create(ticketId: number, input: TimeEntryInput): Promise<number> {
    return autotask.create("TimeEntries", {
      ticketID: ticketId,
      resourceID: input.resourceId,
      roleID: input.roleId,
      startDateTime: input.startDateTime,
      endDateTime: input.endDateTime,
      hoursWorked: input.hoursWorked,
      dateWorked: input.startDateTime,
      ...(input.billingCodeId ? { billingCodeID: input.billingCodeId } : {}),
      ...(input.summaryNotes ? { summaryNotes: input.summaryNotes } : {}),
    });
  },
};
