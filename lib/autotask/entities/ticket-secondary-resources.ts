import "server-only";

import { autotask } from "@/lib/autotask/client";
import { resources } from "@/lib/autotask/entities/resources";
import type { TicketSecondaryResource } from "@/lib/autotask/types";

// Zusätzliche Mitarbeiter (Secondary Resources) eines Tickets: lesen, hinzufügen,
// entfernen. Lesen über den Top-Level-Endpoint (wie im Dashboard), Schreiben über
// den geparenteten Pfad `Tickets/{id}/SecondaryResources` (Child-Objekt). Anlegen
// verlangt resourceID UND roleID (beide Pflicht laut entityInformation/fields).

export interface SecondaryResourceRow {
  id: number; // ID des TicketSecondaryResources-Datensatzes (zum Entfernen)
  resourceID: number;
  roleID: number | null;
  name: string | null;
}

export const ticketSecondaryResources = {
  async byTicket(ticketId: number): Promise<SecondaryResourceRow[]> {
    const rows = await autotask.query<TicketSecondaryResource>(
      "TicketSecondaryResources",
      {
        MaxRecords: 200,
        IncludeFields: ["id", "resourceID", "roleID", "ticketID"],
        Filter: [{ op: "eq", field: "ticketID", value: ticketId }],
      },
      { autoPage: true },
    );
    const names = await resources
      .namesByIds(
        rows
          .map((r) => r.resourceID)
          .filter((n): n is number => typeof n === "number"),
      )
      .catch(() => new Map<number, string>());
    return rows
      .filter((r) => typeof r.resourceID === "number")
      .map((r) => ({
        id: r.id,
        resourceID: r.resourceID as number,
        roleID: r.roleID ?? null,
        name: names.get(r.resourceID as number) ?? null,
      }));
  },

  // Anlegen über den Eltern-Pfad. Gibt die neue Datensatz-ID zurück.
  add(ticketId: number, resourceID: number, roleID: number): Promise<number> {
    return autotask.create(`Tickets/${ticketId}/SecondaryResources`, {
      resourceID,
      roleID,
    });
  },

  // Entfernen über den Eltern-Pfad inkl. Datensatz-ID.
  remove(ticketId: number, id: number): Promise<void> {
    return autotask.del(`Tickets/${ticketId}/SecondaryResources/${id}`);
  },
};
