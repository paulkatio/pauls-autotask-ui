import "server-only";

import { ticketNotes } from "@/lib/autotask/entities/ticket-notes";
import { tickets } from "@/lib/autotask/entities/tickets";
import { resources } from "@/lib/autotask/entities/resources";
import { contacts } from "@/lib/autotask/entities/contacts";
import {
  CONVERSATION_NOTE_TYPES,
  CONVERSATION_TYPE_IDS,
  directionOf,
  type ChatDirection,
} from "@/lib/autotask/conversation";

export interface ChatMessage {
  id: number;
  direction: ChatDirection;
  noteType: number | null;
  createDateTime: string | null;
  title: string | null;
  body: string;
  sender: string;
}

// Schlanker Chat-Payload (nur Konversations-noteTypes), Sender batched aufgelöst.
export async function getTicketChat(ticketId: number): Promise<ChatMessage[]> {
  const notes = await ticketNotes.byTicketTypes(ticketId, CONVERSATION_TYPE_IDS);

  const resourceIds = notes
    .filter((n) => directionOf(n) === "outbound")
    .map((n) => n.creatorResourceID)
    .filter((x): x is number => typeof x === "number");
  const contactIds = notes
    .map((n) => n.createdByContactID)
    .filter((x): x is number => typeof x === "number");

  const [resNames, conNames] = await Promise.all([
    resources.namesByIds(resourceIds),
    contacts.namesByIds(contactIds),
  ]);

  return notes
    .map((n): ChatMessage => {
      const direction = directionOf(n);
      const sender =
        direction === "inbound"
          ? (n.createdByContactID != null
              ? (conNames.get(n.createdByContactID) ?? "Kunde")
              : "Kunde")
          : (n.creatorResourceID != null
              ? (resNames.get(n.creatorResourceID) ?? "Support")
              : "Support");
      return {
        id: n.id,
        direction,
        noteType: n.noteType ?? null,
        createDateTime: n.createDateTime ?? null,
        title: n.title ?? null,
        body: n.description ?? "",
        sender,
      };
    })
    .sort(
      (a, b) =>
        (Date.parse(a.createDateTime ?? "") || 0) -
        (Date.parse(b.createDateTime ?? "") || 0),
    );
}

// Pro Ticket serialisieren: das Set/Reset des UDF darf sich zwischen parallelen
// Sendevorgängen nicht überlappen (kleines Race-Window absichern).
const ticketLocks = new Map<number, Promise<unknown>>();

function withTicketLock<T>(id: number, fn: () => Promise<T>): Promise<T> {
  const prev = ticketLocks.get(id) ?? Promise.resolve();
  const run = prev.then(fn, fn); // nach prev laufen, egal ob prev fehlschlug
  ticketLocks.set(
    id,
    run.then(
      () => {},
      () => {},
    ),
  );
  return run;
}

// Sendet eine Chat-Notiz (immer noteType 18 = outbound).
// Option A (DECISIONS): Das UDF "Kunde benachrichtigen" wird VOR der Notiz auf den
// Schalterwert gesetzt (Ja/Nein) und NICHT zurückgesetzt. Grund: Autotask wertet die
// Workflow-Regel asynchron gegen den AKTUELLEN UDF-Wert aus → ein Sofort-Reset würde
// die Mail verhindern. Pro Ticket serialisiert (Lock).
export async function sendTicketChatNote(
  ticketId: number,
  text: string,
  notify: boolean,
): Promise<number> {
  return withTicketLock(ticketId, async () => {
    // title ist beim Anlegen Pflicht – aus der ersten Zeile ableiten (gekürzt).
    const firstLine = text.split("\n")[0].trim();
    const title =
      (firstLine.length > 120 ? firstLine.slice(0, 117) + "…" : firstLine) ||
      "Chat-Nachricht";
    const noteData = {
      title,
      description: text,
      noteType: CONVERSATION_NOTE_TYPES.outbound,
      publish: 1,
    };
    // UDF VOR der Notiz setzen; kein Reset.
    await tickets.setNotify(ticketId, notify);
    return ticketNotes.create(ticketId, noteData);
  });
}
