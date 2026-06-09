import "server-only";

// Kunden-Mail im Look der Autotask-Vorlage (hell, mit Logo + Footer), damit die
// Mail gleich aussieht – egal ob aus dem normalen Autotask oder aus dieser App.
// E-Mail-Clients verstehen kein externes CSS/keine Variablen → Tabellen-Layout,
// Inline-Styles, hartkodierte Hex. Inhalt schlicht: Anrede mit Vor-/Nachname,
// die getippte Nachricht, Grußformel, kleiner Footer.

const LOGO_URL = "https://www.ssig-it.com/images/Logo-ssig-it-full-bg.png";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface CustomerEmailParts {
  contactName: string; // Vor- + Nachname des Kontakts (darf leer sein)
  message: string; // der ins Chatfeld getippte Text
  orgName: string; // Firmenname, z. B. "SSIG-IT GmbH"
  ticketNumber: string; // z. B. "T20260609.0014"
}

export function buildCustomerEmail({
  contactName,
  message,
  orgName,
  ticketNumber,
}: CustomerEmailParts): { html: string; text: string; subject: string } {
  const name = contactName.trim();
  const greeting = name ? `Hallo ${name},` : "Hallo,";
  const closing = `Ihr Support-Team der ${orgName}`;
  const bodyHtml = escapeHtml(message).replace(/\r?\n/g, "<br>");
  // Ticketnummer im Betreff ist Pflicht fürs Autotask-Threading (B17) – und sagt
  // dem Kunden, worum es geht. Die Nummer NICHT zusätzlich in den Body schreiben.
  const subject = `[${ticketNumber}] Neue Nachricht zu Ihrem Ticket`;

  const text =
    `${greeting}\n\n${message}\n\n${closing}\n\n` +
    `SSIG-IT GmbH · Zum weißen Jura 3 · 89143 Blaubeuren · Deutschland\n` +
    `Tel: +49 7335 1633110 · support@ssig-it.com · info.ssig-it.com`;

  const font = "Arial, Helvetica, sans-serif";
  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="x-ua-compatible" content="ie=edge">
<title>${escapeHtml(orgName)} · Ticket ${escapeHtml(ticketNumber)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8f8f8;color:#222222;font-family:${font};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8f8f8" style="background-color:#f8f8f8;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" class="ssig-mail-container" cellpadding="0" cellspacing="0" border="0" width="640" style="width:100%;max-width:640px;min-width:320px;background-color:#ffffff;border:1px solid #e0e0e0;">
<!-- Logo -->
<tr><td align="center" style="padding:28px 24px 28px 24px;border-bottom:1px solid #e0e0e0;">
<img src="${LOGO_URL}" width="280" alt="${escapeHtml(orgName)}" style="display:block;width:100%;max-width:280px;height:auto;border:0;">
</td></tr>
<!-- Nachricht -->
<tr><td style="padding:28px 24px;color:#222222;font-family:${font};font-size:15px;line-height:1.6;">
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#222222;">${escapeHtml(greeting)}</p>
<div style="margin:0 0 20px 0;font-size:15px;line-height:1.7;color:#222222;">${bodyHtml}</div>
<p style="margin:0;font-size:15px;line-height:1.6;color:#222222;">${escapeHtml(closing)}</p>
</td></tr>
<!-- Footer -->
<tr><td style="padding:24px;text-align:center;font-family:${font};font-size:12px;color:#777777;line-height:1.6;border-top:1px solid #e0e0e0;background-color:#fafafa;">
<p style="margin:0 0 8px 0;font-size:12px;color:#777777;">SSIG-IT GmbH · Zum weißen Jura 3 · 89143 Blaubeuren · Deutschland</p>
<p style="margin:0 0 8px 0;font-size:12px;color:#777777;">Tel: <a href="tel:+4973351633110" style="color:#777777;">+49 7335 1633110</a> · E-Mail: <a href="mailto:support@ssig-it.com" style="color:#777777;">support@ssig-it.com</a> · Web: <a href="https://info.ssig-it.com" style="color:#777777;">info.ssig-it.com</a></p>
<p style="margin:12px 0 0 0;font-size:11px;color:#777777;"><a href="https://www.ssig-it.com/impressum.html" style="color:#777777;">Impressum</a> · <a href="https://www.ssig-it.com/datenschutz.html" style="color:#777777;">Datenschutz</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { html, text, subject };
}
