import "server-only";

import { autotask } from "@/lib/autotask/client";
import type { TicketChecklistItem } from "@/lib/autotask/types";

// Ticket-Checkliste = in Autotask eingebaute „To-Dos" (Objekt TicketChecklistItems).
// WICHTIG (verifiziert 2026-06-11 gegen PROD): Der geparentete Listenpfad
// `Tickets/{id}/ChecklistItems/query` liefert 404 — genau wie bei Anhängen. Deshalb
// Top-Level-Query mit `ticketID`-Filter. `ticketID` ist read-only, als Filter aber nutzbar.
const FIELDS = [
  "id",
  "ticketID",
  "itemName",
  "isCompleted",
  "isImportant",
  "position",
  "completedDateTime",
];

export const ticketChecklist = {
  async byTicket(ticketId: number): Promise<TicketChecklistItem[]> {
    const rows = await autotask.query<TicketChecklistItem>(
      "TicketChecklistItems",
      {
        MaxRecords: 200,
        IncludeFields: FIELDS,
        Filter: [{ op: "eq", field: "ticketID", value: ticketId }],
      },
      { autoPage: false },
    );
    // Stabile Reihenfolge: nach position, dann id.
    return rows.sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id,
    );
  },

  // Punkt abhaken/enthaken. Schreib-Pfad verifiziert 2026-06-11 gegen PROD: Update
  // läuft über den PARENT-Pfad `Tickets/{id}/ChecklistItems` (Top-Level-PATCH = 404),
  // Feld `isCompleted`. Autotask setzt completedByResourceID = API-User selbst.
  setCompleted: (
    ticketId: number,
    itemId: number,
    isCompleted: boolean,
  ): Promise<number> =>
    autotask.update(`Tickets/${ticketId}/ChecklistItems`, {
      id: itemId,
      isCompleted,
    }),
};
