import "server-only";

// Gemeinsame Hülle aller SSIG-Mails (Kunden-Mail + interne Zuweisungs-Mail), damit
// beide IDENTISCH aussehen: Logo-Kopf, weiße Karte (640px), Footer. E-Mail-Clients
// verstehen kein externes CSS/keine Variablen -> Tabellen-Layout, Inline-Styles,
// hartkodierte Hex. Der Mittelteil (`innerHtml`) ist eine fertige
// <tr><td>…</td></tr>-Sektion, die der jeweilige Builder liefert.

const LOGO_URL = "https://www.ssig-it.com/images/Logo-ssig-it-full-bg.png";

// Schriftfamilie der Mails (eine Quelle für alle Builder).
export const MAIL_FONT = "Arial, Helvetica, sans-serif";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface MailShellParts {
  orgName: string; // Firmenname für alt-Text + <title>
  headTitle: string; // Inhalt des <title>-Tags
  innerHtml: string; // fertige <tr><td>…</td></tr>-Sektion(en) für den Mittelteil
  logoWidth?: number; // Logo-Breite in px (Default 280 = Kunden-Mail-Look)
}

export function renderMailShell({
  orgName,
  headTitle,
  innerHtml,
  logoWidth = 280,
}: MailShellParts): string {
  const font = MAIL_FONT;
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="x-ua-compatible" content="ie=edge">
<title>${escapeHtml(headTitle)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8f8f8;color:#222222;font-family:${font};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8f8f8" style="background-color:#f8f8f8;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" class="ssig-mail-container" cellpadding="0" cellspacing="0" border="0" width="640" style="width:100%;max-width:640px;min-width:320px;background-color:#ffffff;border:1px solid #e0e0e0;">
<!-- Logo -->
<tr><td align="center" style="padding:28px 24px 28px 24px;border-bottom:1px solid #e0e0e0;">
<img src="${LOGO_URL}" width="${logoWidth}" alt="${escapeHtml(orgName)}" style="display:block;width:100%;max-width:${logoWidth}px;height:auto;border:0;">
</td></tr>
${innerHtml}
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
}
