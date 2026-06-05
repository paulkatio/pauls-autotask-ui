// EINE konfigurierbare Stelle für die Chat-Konversation: welche TicketNote-Typen
// als Kundenkommunikation gelten und welche Richtung sie haben.
// PROVISORISCH (endgültige Festlegung gegen echte Autotask-Nutzung vor B11):
//   18  = Kundenportal-Notiz  -> outbound (von uns an den Kunden, rechts)
//   101 = Email Note          -> inbound  (vom Kunden an uns, links)

export const CONVERSATION_NOTE_TYPES = {
  outbound: 18,
  inbound: 101,
} as const;

export const CONVERSATION_TYPE_IDS: number[] = [
  CONVERSATION_NOTE_TYPES.outbound,
  CONVERSATION_NOTE_TYPES.inbound,
];

// Diskriminator für den Mailversand ist NICHT der noteType, sondern das Ticket-UDF
// "Kunde benachrichtigen" (Ja/Nein). Grund: noteType 18 ist als Workflow-Regel-
// Bedingungswert nicht verfügbar (nur 1/2/3 wählbar). Chat-Notiz = immer noteType 18;
// das UDF steuert, ob die Autotask-Workflow-Regel die Kunden-Mail auslöst.
export const NOTIFY_UDF = {
  name: "Kunde benachrichtigen",
  yes: "Ja",
  no: "Nein",
} as const;

export type ChatDirection = "inbound" | "outbound";

// Richtung: primär über den noteType (101 = inbound). Zusätzliches, klareres Signal:
// createdByContactID gesetzt = von einem Kontakt erstellt -> inbound.
export function directionOf(note: {
  noteType?: number;
  createdByContactID?: number | null;
}): ChatDirection {
  if (note.noteType === CONVERSATION_NOTE_TYPES.inbound) return "inbound";
  if (note.createdByContactID != null) return "inbound";
  return "outbound";
}
