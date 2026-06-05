// Zentrale Konfiguration für „Neues Ticket".
//
// Standard-Queue beim Anlegen: Level I-Support (queueID 29682833).
// Verifiziert gegen .env.local (App-Mandant) am 2026-06-04 – die Queue-Picklist
// enthält 29682833 = „Level I-Support" (siehe DECISIONS „V5 – Tickets").
//
// Wird im Neues-Ticket-Dialog vorbelegt, damit der von Autotask verlangte
// Constraint „queueID ODER (assignedResourceID + assignedResourceRoleID)" bereits
// erfüllt ist. Der Client-Guard im Dialog bleibt als Sicherung erhalten (falls der
// Nutzer bewusst „— Keine" wählt und auch nicht zuweist).
export const NEW_TICKET_DEFAULT_QUEUE = 29682833;
