import "server-only";

import { renderMailShell, escapeHtml, MAIL_FONT } from "@/lib/mail/shell";

// Interne Zuweisungs-Mail an den Mitarbeiter, dem ein Ticket zugewiesen wurde.
// Gleicher Look wie die Kunden-Mail (gemeinsame Hülle: Logo + Footer). Enthält je
// Ticket Nummer + Titel und ZWEI Links: die App-Ansicht (primär) und „In Autotask
// öffnen" (sekundär). Mehrere Tickets werden in EINER gebündelten Mail gelistet.

export interface AssignmentEmailTicket {
  ticketNumber: string;
  title: string;
  appUrl: string | null; // App-Ticketseite (AUTH_URL/tickets/<id>)
  autotaskUrl: string | null; // Autotask-Deeplink
}

// Inline-Icons der Button (als CID-Attachment eingebettet, nicht extern geladen –
// localhost/Prod-URLs sind in Mail-Clients nicht zuverlässig erreichbar). Das
// notify-Modul liest die Dateien aus public/ und hängt sie unter diesen IDs an.
export const ASSIGN_MAIL_ICONS = {
  app: { cid: "atui-app-logo", file: "autotask-logo.png" },
  autotask: { cid: "atui-at-mark", file: "autotask-logo-mark.png" },
} as const;

export interface AssignmentEmailParts {
  assigneeFirstName: string; // Vorname für die Anrede (darf leer sein)
  assignedByName?: string; // Wer hat zugewiesen (eingeloggter Nutzer; darf leer sein)
  orgName: string;
  tickets: AssignmentEmailTicket[];
  withIcons?: boolean; // Inline-Icons (CID) einbetten? (notify hängt die Dateien an)
}

function button(
  href: string,
  label: string,
  primary: boolean,
  iconUrl: string | null,
): string {
  const style = primary
    ? "display:inline-block;background-color:#222222;color:#ffffff;text-decoration:none;padding:9px 16px;font-size:14px;border-radius:6px;border:1px solid #222222;"
    : "display:inline-block;background-color:#ffffff;color:#222222;text-decoration:none;padding:9px 16px;font-size:14px;border-radius:6px;border:1px solid #c8c8c8;";
  const icon = iconUrl
    ? `<img src="${escapeHtml(iconUrl)}" width="16" height="16" alt="" style="display:inline-block;vertical-align:middle;width:16px;height:16px;margin-right:7px;border:0;">`
    : "";
  return `<a href="${escapeHtml(href)}" style="${style}">${icon}<span style="vertical-align:middle;">${escapeHtml(label)}</span></a>`;
}

export function buildAssignmentEmail({
  assigneeFirstName,
  assignedByName = "",
  orgName,
  tickets,
  withIcons = false,
}: AssignmentEmailParts): { html: string; text: string; subject: string } {
  // Button-Icons als Inline-CID (vom notify-Modul angehängt): App-Logo (orange, wie
  // Sidebar) + Autotask-Mark. Ohne Icons -> reine Text-Buttons.
  const appIcon = withIcons ? `cid:${ASSIGN_MAIL_ICONS.app.cid}` : null;
  const autotaskIcon = withIcons ? `cid:${ASSIGN_MAIL_ICONS.autotask.cid}` : null;
  const name = assigneeFirstName.trim();
  const greeting = name ? `Hallo ${name},` : "Hallo,";
  const n = tickets.length;
  const by = assignedByName.trim();
  const what = n === 1 ? "ein Ticket" : `${n} Tickets`;
  // Absender (eingeloggter Nutzer) in die Intro-Zeile, sonst neutrale Variante.
  const intro = by
    ? `${by} hat dir ${what} zugewiesen:`
    : n === 1
      ? "dir wurde ein Ticket zugewiesen:"
      : `dir wurden ${n} Tickets zugewiesen:`;
  const subject =
    n === 1
      ? `[${tickets[0].ticketNumber}] Ticket wurde dir zugewiesen`
      : `${n} Tickets wurden dir zugewiesen`;
  const closing =
    "Diese Nachricht wurde automatisch vom Service-Desk-System erzeugt.";
  const font = MAIL_FONT;

  const ticketBlocks = tickets
    .map((t) => {
      const buttons = [
        t.appUrl
          ? button(t.appUrl, "Ticket in Autotask UI öffnen", true, appIcon)
          : "",
        t.autotaskUrl
          ? button(t.autotaskUrl, "In klassischem Autotask öffnen", false, autotaskIcon)
          : "",
      ]
        .filter(Boolean)
        .map((b) => `<td style="padding:0 8px 0 0;">${b}</td>`)
        .join("");
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border:1px solid #e0e0e0;border-radius:6px;margin:0 0 12px 0;">
<tr><td style="padding:16px 18px;font-family:${font};">
<p style="margin:0 0 4px 0;font-size:15px;font-weight:bold;color:#222222;">${escapeHtml(t.ticketNumber)}</p>
<p style="margin:0 0 14px 0;font-size:14px;line-height:1.5;color:#444444;">${escapeHtml(t.title || "—")}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${buttons}</tr></table>
</td></tr>
</table>`;
    })
    .join("");

  const innerHtml = `<!-- Zuweisung -->
<tr><td style="padding:28px 24px;color:#222222;font-family:${font};font-size:15px;line-height:1.6;">
<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#222222;">${escapeHtml(greeting)}</p>
<p style="margin:0 0 18px 0;font-size:15px;line-height:1.6;color:#222222;">${escapeHtml(intro)}</p>
${ticketBlocks}
<p style="margin:18px 0 0 0;font-size:13px;line-height:1.6;color:#777777;">${escapeHtml(closing)}</p>
</td></tr>`;

  const html = renderMailShell({
    orgName,
    headTitle:
      n === 1
        ? `${orgName} · Ticket ${tickets[0].ticketNumber}`
        : `${orgName} · ${n} Tickets zugewiesen`,
    innerHtml,
    // Interne Mail: dezent kleineres Logo (Kunden-Mail bleibt bei 280).
    logoWidth: 180,
  });

  const text =
    `${greeting}\n\n${intro}\n\n` +
    tickets
      .map((t) => {
        const lines = [`• ${t.ticketNumber} — ${t.title || "—"}`];
        if (t.appUrl) lines.push(`  App: ${t.appUrl}`);
        if (t.autotaskUrl) lines.push(`  Autotask: ${t.autotaskUrl}`);
        return lines.join("\n");
      })
      .join("\n\n") +
    `\n\n${closing}`;

  return { html, text, subject };
}
