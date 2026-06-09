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

// Autotask hängt an JEDE per eingehender E-Mail erzeugte Notiz diesen Footer an.
// Zuverlässiges Inbound-Signal AUCH dann, wenn Autotask den Absender auf eine
// Resource statt einen Kontakt gemappt hat (dann ist createdByContactID leer) –
// verifiziert an Ticket 56313, Notiz 30100151 (Antwort aus einer Mitarbeiter-Mailbox).
// Interne Notizen (noteType 1/2/3 ohne Mailbezug) enthalten den Marker NICHT.
export const INBOUND_EMAIL_MARKER = "Durch eingehende E-Mail-Verarbeitung erstellt";

export function isInboundEmailNote(note: {
  description?: string | null;
}): boolean {
  return (note.description ?? "").includes(INBOUND_EMAIL_MARKER);
}

// Richtung: inbound, wenn (a) noteType 101 (Email Note), (b) von einem Kontakt
// erstellt (createdByContactID gesetzt) ODER (c) der Mail-Verarbeitungs-Marker im
// Body steckt. Sonst outbound (unsere Notiz, noteType 18).
export function directionOf(note: {
  noteType?: number;
  createdByContactID?: number | null;
  description?: string | null;
}): ChatDirection {
  if (note.noteType === CONVERSATION_NOTE_TYPES.inbound) return "inbound";
  if (note.createdByContactID != null) return "inbound";
  if (isInboundEmailNote(note)) return "inbound";
  return "outbound";
}
