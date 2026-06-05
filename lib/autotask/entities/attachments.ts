import "server-only";

import { autotask } from "@/lib/autotask/client";
import type { TicketAttachment } from "@/lib/autotask/types";

// Ticket-Anhänge (lesend, verifiziert 2026-06-03).
// Liste über den Eltern-Pfad Tickets/{id}/Attachments/query (Metadaten, ohne `data`).
// Datei-Bytes nur per Einzelabruf /TicketAttachments/{id} (Top-Level liefert `data`).
const LIST_FIELDS = [
  "id",
  "title",
  "fullPath",
  "contentType",
  "fileSize",
  "attachDate",
  "parentID",
  "ticketID",
];

export const attachments = {
  async byTicket(ticketId: number): Promise<TicketAttachment[]> {
    // Top-Level-Query mit parentID-Filter (verifiziert 2026-06-03; der geparente
    // Pfad Tickets/{id}/Attachments/query existiert NICHT -> 404).
    const rows = await autotask.query<TicketAttachment>(
      "TicketAttachments",
      {
        MaxRecords: 100,
        IncludeFields: LIST_FIELDS,
        Filter: [{ op: "eq", field: "parentID", value: ticketId }],
      },
      { autoPage: false },
    );
    return rows.sort((a, b) =>
      (b.attachDate ?? "").localeCompare(a.attachDate ?? ""),
    );
  },

  // Einzelner Anhang inkl. base64-`data` (für den Download). Gibt null zurück,
  // wenn der Anhang nicht zum erwarteten Ticket gehört (Zugriffsschutz).
  async getForDownload(
    ticketId: number,
    attachmentId: number,
  ): Promise<TicketAttachment | null> {
    const rec = await autotask.get<TicketAttachment>(
      "TicketAttachments",
      attachmentId,
    );
    if (!rec) return null;
    const owner = rec.ticketID ?? rec.parentID ?? null;
    if (owner !== ticketId) return null;
    return rec;
  },

  // Neuen FILE-Anhang anlegen (verifiziert 2026-06-04 gegen .env.local: POST
  // Tickets/{id}/Attachments mit attachmentType FILE_ATTACHMENT + base64 `data`
  // -> itemId; Round-Trip an 43180 inhaltsgleich zurückgelesen). `contentType`
  // ist read-only und wird von Autotask aus der Dateiendung abgeleitet – daher
  // hier NICHT mitgesendet. Gibt die neue Anhang-id zurück.
  async upload(
    ticketId: number,
    input: { fileName: string; dataBase64: string },
  ): Promise<number> {
    return autotask.create(`Tickets/${ticketId}/Attachments`, {
      data: input.dataBase64,
      title: input.fileName,
      fullPath: input.fileName,
      attachmentType: "FILE_ATTACHMENT",
      publish: 1,
    });
  },
};
