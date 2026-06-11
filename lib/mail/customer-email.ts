import "server-only";

import { renderMailShell, escapeHtml, MAIL_FONT } from "@/lib/mail/shell";
import { sanitizeRichHtml, plainTextFromRich } from "@/lib/html/sanitize-rich";

// Kunden-Mail im Look der Autotask-Vorlage (Logo + Footer kommen aus der gemeinsamen
// Mail-Hülle, damit Kunden- und Zuweisungs-Mail identisch aussehen). Inhalt schlicht:
// Anrede mit Vor-/Nachname, die getippte Nachricht, Grußformel.
//
// `isHtml`: Stammt die Nachricht aus dem Rich-Text-Editor (kleiner b/i/u/ul-Subset),
// wird sie sanitisiert und als HTML eingebettet; sonst als Plaintext escaped + nl2br.

export interface CustomerEmailParts {
  contactName: string; // Vor- + Nachname des Kontakts (darf leer sein)
  message: string; // der ins Chatfeld getippte Text (Plaintext ODER Rich-HTML)
  orgName: string; // Firmenname, z. B. "SSIG-IT GmbH"
  ticketNumber: string; // z. B. "T20260609.0014"
  isHtml?: boolean; // message ist Rich-HTML (Editor-Subset)
}

export function buildCustomerEmail({
  contactName,
  message,
  orgName,
  ticketNumber,
  isHtml = false,
}: CustomerEmailParts): { html: string; text: string; subject: string } {
  const name = contactName.trim();
  const greeting = name ? `Hallo ${name},` : "Hallo,";
  const closing = `Ihr Support-Team der ${orgName}`;
  // Rich: sanitisiert einbetten. Plaintext: escapen + Zeilenumbrüche zu <br>.
  const bodyHtml = isHtml
    ? sanitizeRichHtml(message)
    : escapeHtml(message).replace(/\r?\n/g, "<br>");
  // Plaintext-Fassung (text/plain-Teil): Rich -> entschärfter Klartext.
  const plainMessage = isHtml ? plainTextFromRich(message) : message;
  // Ticketnummer im Betreff ist Pflicht fürs Autotask-Threading (B17) – und sagt
  // dem Kunden, worum es geht. Die Nummer NICHT zusätzlich in den Body schreiben.
  const subject = `[${ticketNumber}] Neue Nachricht zu Ihrem Ticket`;

  const text =
    `${greeting}\n\n${plainMessage}\n\n${closing}\n\n` +
    `SSIG-IT GmbH · Zum weißen Jura 3 · 89143 Blaubeuren · Deutschland\n` +
    `Tel: +49 7335 1633110 · support@ssig-it.com · info.ssig-it.com`;

  const font = MAIL_FONT;
  const innerHtml = `<!-- Nachricht -->
<tr><td style="padding:28px 24px;color:#222222;font-family:${font};font-size:15px;line-height:1.6;">
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#222222;">${escapeHtml(greeting)}</p>
<div style="margin:0 0 20px 0;font-size:15px;line-height:1.7;color:#222222;">${bodyHtml}</div>
<p style="margin:0;font-size:15px;line-height:1.6;color:#222222;">${escapeHtml(closing)}</p>
</td></tr>`;

  const html = renderMailShell({
    orgName,
    headTitle: `${orgName} · Ticket ${ticketNumber}`,
    innerHtml,
  });

  return { html, text, subject };
}
