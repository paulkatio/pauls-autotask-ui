import "server-only";

import { autotask } from "@/lib/autotask/client";
import type { TicketNote } from "@/lib/autotask/types";
import { INBOUND_EMAIL_MARKER } from "@/lib/autotask/conversation";

const NOTE_FIELDS = [
  "id",
  "ticketID",
  "title",
  "description",
  "noteType",
  "publish",
  "createDateTime",
  "creatorResourceID",
  "createdByContactID",
];

// Interne Notiz (Aktivität-Feed): noteType 2 (Aufgabendetails) + publish 1
// (All Autotask Users = intern). KRITISCH: NIEMALS noteType 18 (Kundenportal) und
// NIEMALS das UDF „Kunde benachrichtigen" anfassen – diese Notiz darf NIE
// kundensichtbar sein und löst keine Mail aus. Verifiziert 2026-06-04 (Note
// 29926308 an Ticket 43183: noteType 2, publish 1, UDF unverändert „nicht gesetzt").
export const INTERNAL_NOTE = { noteType: 2, publish: 1 } as const;

export const ticketNotes = {
  // Alle Notizen eines Tickets (alle Typen), chronologisch nutzbar.
  byTicket: (ticketId: number): Promise<TicketNote[]> =>
    autotask.query<TicketNote>("TicketNotes", {
      MaxRecords: 500,
      IncludeFields: NOTE_FIELDS,
      Filter: [{ op: "eq", field: "ticketID", value: ticketId }],
    }),

  // Konversations-Notizen fürs Chat-Polling. Inbound deckt drei Fälle ab:
  //  (a) kundenseitige noteTypes (typeIds, z. B. 18/101),
  //  (b) jede vom Kontakt erstellte Notiz (`createdByContactID` gesetzt),
  //  (c) per eingehender E-Mail erzeugte Notizen (Body-Marker) – das fängt
  //      Mailantworten, die Autotask auf eine RESOURCE statt einen Kontakt mappt
  //      (createdByContactID leer, noteType 3), verifiziert an Ticket 56313.
  // Echte Inbound-Mailantworten kommen mandantenweit als noteType 3 (NICHT 101,
  // B17-DISCOVERY). Interne Resource-Notizen (Typ 1/2/3 ohne Kontakt UND ohne Marker)
  // bleiben ausgeschlossen, gehören also weiter nur in den Aktivität-Feed.
  byTicketConversation: (
    ticketId: number,
    typeIds: number[],
  ): Promise<TicketNote[]> =>
    autotask.query<TicketNote>("TicketNotes", {
      MaxRecords: 500,
      IncludeFields: NOTE_FIELDS,
      Filter: [
        { op: "eq", field: "ticketID", value: ticketId },
        {
          op: "or",
          items: [
            { op: "in", field: "noteType", value: typeIds },
            { op: "exist", field: "createdByContactID" },
            { op: "contains", field: "description", value: INBOUND_EMAIL_MARKER },
          ],
        },
      ],
    }),

  // Notiz anlegen über den Eltern-Pfad (Tickets/{id}/Notes), gibt itemId zurück.
  create: (
    ticketId: number,
    data: { description: string; noteType: number; publish: number; title?: string },
  ): Promise<number> =>
    autotask.create(`Tickets/${ticketId}/Notes`, { ...data, ticketID: ticketId }),

  // Interne Notiz (Aktivität): fest auf INTERNAL_NOTE (noteType 2 / publish 1).
  // `title` ist bei TicketNotes Pflicht (DECISIONS B11) – aus dem Text ableiten,
  // falls der Nutzer keinen Titel angibt.
  createInternal: (
    ticketId: number,
    { title, description }: { title?: string; description: string },
  ): Promise<number> => {
    const firstLine = description.split("\n")[0].trim();
    const finalTitle =
      (title && title.trim()) ||
      (firstLine.length > 120 ? firstLine.slice(0, 117) + "…" : firstLine) ||
      "Notiz";
    return autotask.create(`Tickets/${ticketId}/Notes`, {
      ticketID: ticketId,
      title: finalTitle,
      description,
      noteType: INTERNAL_NOTE.noteType,
      publish: INTERNAL_NOTE.publish,
    });
  },
};
