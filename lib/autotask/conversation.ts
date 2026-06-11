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

// ----- Aktivität-Feed: Rauschen-Erkennung (B…, Paul) -----
// Reine Automations-/KI-Resources, die Notizen schreiben (n8n KI-Kategorisierung,
// Firmenzuordnung). BEWUSST NICHT die System-Resource 4 (Workflow) hier listen –
// die ist auch der Mock-Admin; Workflow-Notizen sind über noteType 13 erfasst.
// Verifiziert an Ticket 56313 (Notizen 30100124/30100126, creatorResourceID 29682944).
export const AUTOMATION_RESOURCE_IDS: number[] = [29682944];

const WORKFLOW_NOTE_TYPE = 13; // „Workflow-Regel ausgelöst"
const SYSTEM_NOTIFICATION_PUBLISH = 4; // „Service Desk-Benachrichtigung"

// Rauschen im Aktivität-Feed: Workflow-Regel-Notizen (noteType 13), reine
// Automations-/KI-Notizen und System-Benachrichtigungen (publish 4 / Titel
// „Service Desk-Benachrichtigung"). KONSERVATIV – im Zweifel KEIN Rauschen, damit
// echte Menschen-Notizen nie verschwinden.
export function isActivityNoise(note: {
  noteType?: number;
  publish?: number;
  creatorResourceID?: number | null;
  title?: string | null;
}): boolean {
  if (note.noteType === WORKFLOW_NOTE_TYPE) return true;
  if (
    note.creatorResourceID != null &&
    AUTOMATION_RESOURCE_IDS.includes(note.creatorResourceID)
  )
    return true;
  if (note.publish === SYSTEM_NOTIFICATION_PUBLISH) return true;
  if ((note.title ?? "").startsWith("Service Desk-Benachrichtigung")) return true;
  return false;
}

// Chat-Duplikat: Outbound-Chatnotiz (noteType 18) steht bereits im Chat-Panel und
// gehört NICHT zusätzlich in den Aktivität-Feed. Inbound-Kundenantworten bleiben
// im Feed (Pauls „nur Kundenantworten und SEHR relevante Sachen").
export function isChatDuplicate(note: { noteType?: number }): boolean {
  return note.noteType === CONVERSATION_NOTE_TYPES.outbound;
}
