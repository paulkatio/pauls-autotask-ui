import "server-only";

import { ticketNotes } from "@/lib/autotask/entities/ticket-notes";
import { tickets } from "@/lib/autotask/entities/tickets";
import { resources } from "@/lib/autotask/entities/resources";
import { contacts } from "@/lib/autotask/entities/contacts";
import { sendMail, isResendConfigured } from "@/lib/mail/resend";
import { getMailSenderName } from "@/lib/branding-server";
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
  const notes = await ticketNotes.byTicketConversation(
    ticketId,
    CONVERSATION_TYPE_IDS,
  );

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
      const rawBody = n.description ?? "";
      return {
        id: n.id,
        direction,
        noteType: n.noteType ?? null,
        createDateTime: n.createDateTime ?? null,
        title: n.title ?? null,
        // Inbound-Mailantworten schleppen den zitierten Original-Thread + Signatur-
        // Rauschen mit – für die Chat-Anzeige auf die eigentliche Antwort kürzen.
        body: direction === "inbound" ? cleanInboundBody(rawBody) : rawBody,
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

export interface ChatMailStatus {
  attempted: boolean; // wurde ein Resend-Versand überhaupt versucht?
  sent: boolean; // Resend hat 2xx geliefert
  error?: string; // Grund, falls attempted && !sent
  skipped?: string; // Grund, falls kein Resend-Versuch (kein Kontakt/Mail, deaktiviert …)
}

export interface SendChatResult {
  itemId: number; // angelegte Notiz (Quelle der Wahrheit am Ticket)
  mail: ChatMailStatus;
}

// Sendet eine Chat-Notiz (immer noteType 18 = outbound) und – bei notify – die
// Kundenmail über Resend.
//
// Reihenfolge (B17-DISCOVERY §6.1/§6.3): Notiz ZUERST. Scheitert sie → throw,
// keine Mail (sauberer Abbruch). Notiz ok, Mail scheitert → Notiz bleibt
// bestehen, der Fehler wandert über ChatMailStatus an die UI (kein stilles
// Schlucken). Pro Ticket serialisiert (Lock).
//
// Resend ist der Versandweg (B17-DISCOVERY §6.4). Solange Resend NICHT
// konfiguriert ist, fällt der Code auf den alten UDF/Workflow-Pfad zurück
// (tickets.setNotify), damit nichts hart bricht.
export async function sendTicketChatNote(
  ticketId: number,
  text: string,
  notify: boolean,
): Promise<SendChatResult> {
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

    // 1) Notiz zuerst. Fehler hier propagiert (throw) → keine Mail.
    const itemId = await ticketNotes.create(ticketId, noteData);

    const mail: ChatMailStatus = { attempted: false, sent: false };

    if (!notify) {
      mail.skipped = "Mailversand für diese Nachricht deaktiviert.";
      return { itemId, mail };
    }

    // Alt-Pfad: ohne Resend-Konfig den UDF/Workflow-Weg nutzen (Bestandsverhalten).
    if (!isResendConfigured()) {
      await tickets.setNotify(ticketId, true);
      mail.skipped = "Resend nicht konfiguriert – UDF/Workflow-Pfad genutzt.";
      return { itemId, mail };
    }

    // 2) Empfänger = Mail des Ticket-Kontakts auflösen; dann Resend.
    mail.attempted = true;
    try {
      const ticket = await tickets.get(ticketId);
      const contactId = ticket?.contactID ?? null;
      if (contactId == null) {
        mail.attempted = false;
        mail.skipped = "Ticket hat keinen Kontakt – keine Mail versendet.";
        return { itemId, mail };
      }
      const contact = await contacts.get(contactId);
      const to = contact?.emailAddress?.trim();
      if (!to) {
        mail.attempted = false;
        mail.skipped = "Kontakt hat keine E-Mail – keine Mail versendet.";
        return { itemId, mail };
      }

      // Ticketnummer im Betreff genügt fürs Autotask-Threading (B17-DISCOVERY §6.2).
      const number = ticket?.ticketNumber ?? `#${ticketId}`;
      const ticketTitle = ticket?.title?.trim() ?? "";
      const subject = ticketTitle ? `[${number}] ${ticketTitle}` : `[${number}]`;
      const senderName = await getMailSenderName();
      const textBody = `${text}\n\n—\n${senderName}\nTicket ${number}`;
      const html =
        `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5">` +
        `<p style="white-space:pre-wrap;margin:0 0 16px">${escapeHtml(text)}</p>` +
        `<hr style="border:none;border-top:1px solid #e5e5e5;margin:16px 0">` +
        `<p style="color:#666;margin:0">${escapeHtml(senderName)} · Ticket ${escapeHtml(number)}</p>` +
        `</div>`;

      await sendMail({ to, subject, text: textBody, html });
      mail.sent = true;
    } catch (e) {
      mail.error = e instanceof Error ? e.message : "Mailversand fehlgeschlagen.";
    }

    return { itemId, mail };
  });
}

// Inbound-Mailantwort fürs Chat-Display säubern: zitierten Original-Thread
// abschneiden und Mail-Token-Rauschen entfernen. Konservativ – schneidet nur an
// klaren Zitat-Trennern (Outlook/Apple Mail), damit keine echte Antwort verloren geht.
function cleanInboundBody(raw: string): string {
  let text = raw ?? "";
  const lines = text.split(/\r?\n/);
  const boundary = lines.findIndex(
    (l) =>
      /^_{5,}\s*$/.test(l) || // Outlook-Trennlinie vor „Von:"
      /^-{2,}\s*Original Message\s*-{2,}/i.test(l) ||
      /^\s*Am .+ schrieb.*:\s*$/.test(l) || // „Am … schrieb …:"
      /^\s*On .+ wrote:\s*$/.test(l), // „On … wrote:"
  );
  if (boundary > 0) text = lines.slice(0, boundary).join("\n");

  // cid-Bildplatzhalter und <mailto:>/<https:>-Duplikate aus Signaturen entfernen.
  text = text
    .replace(/\[cid:[^\]]+\]/gi, "")
    .replace(/\s*<(?:mailto:|https?:)[^>]+>/gi, "");

  // Mehrfach-Leerzeilen zusammenfassen, trimmen.
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
