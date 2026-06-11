import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { autotask } from "@/lib/autotask/client";
import type { Ticket } from "@/lib/autotask/types";
import { resources } from "@/lib/autotask/entities/resources";
import { autotaskTicketUrl } from "@/lib/autotask/links";
import { sendMail, isResendConfigured } from "@/lib/mail/resend";
import {
  buildAssignmentEmail,
  ASSIGN_MAIL_ICONS,
} from "@/lib/mail/assignment-email";
import { getOrgName } from "@/lib/branding-server";

// Button-Icons einmal aus public/ lesen (base64), dann gecacht. Schlägt das Lesen
// fehl (z. B. eingeschränktes FS), fällt die Mail auf Text-Buttons zurück.
let assignIconCache: { app: string; at: string } | null | undefined;
function loadAssignIcons(): { app: string; at: string } | null {
  if (assignIconCache !== undefined) return assignIconCache;
  try {
    const dir = join(process.cwd(), "public");
    assignIconCache = {
      app: readFileSync(join(dir, ASSIGN_MAIL_ICONS.app.file)).toString("base64"),
      at: readFileSync(join(dir, ASSIGN_MAIL_ICONS.autotask.file)).toString(
        "base64",
      ),
    };
  } catch {
    assignIconCache = null;
  }
  return assignIconCache;
}

export interface AssignNotifyResult {
  attempted: boolean; // Resend-Versand überhaupt versucht?
  sent: boolean; // Resend lieferte 2xx
  recipient?: string; // Empfänger-Mail (Debug)
  recipientName?: string; // Empfänger-Name (für die Toast-Bestätigung)
  ticketCount?: number; // Anzahl gebündelter Tickets
  skipped?: string; // Grund, falls kein Versuch (keine Mail/Resource/Resend …)
  error?: string; // Grund, falls attempted && !sent
}

// App-Basis-URL aus der kanonischen Auth-URL ableiten (ohne abschließenden Slash).
// Auth.js v5 nutzt AUTH_URL, ältere Setups NEXTAUTH_URL – beide akzeptieren.
function appBaseUrl(): string | null {
  const raw = (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL)?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

// Schickt EINE (ggf. gebündelte) Zuweisungs-Mail an die Resource. Best effort:
// wirft nicht, sondern meldet den Status strukturiert zurück (Benachrichtigung
// darf den eigentlichen Schreibvorgang nie kippen).
export async function notifyAssignment(
  resourceId: number,
  ticketIds: number[],
  assignedByName: string = "",
): Promise<AssignNotifyResult> {
  const ids = [...new Set(ticketIds.filter((n) => Number.isFinite(n)))];
  if (!Number.isFinite(resourceId) || ids.length === 0) {
    return { attempted: false, sent: false, skipped: "Keine Tickets/Resource." };
  }
  if (!isResendConfigured()) {
    return {
      attempted: false,
      sent: false,
      skipped: "Resend nicht konfiguriert – keine Zuweisungs-Mail.",
    };
  }

  try {
    const resource = await resources.get(resourceId);
    const to = resource?.email?.trim();
    if (!to) {
      return {
        attempted: false,
        sent: false,
        skipped: "Resource hat keine E-Mail – keine Mail versendet.",
      };
    }

    // Tickets gebündelt in EINEM Request (in-Operator), Nummer + Titel.
    const rows = await autotask.query<Ticket>("Tickets", {
      MaxRecords: 200,
      IncludeFields: ["id", "ticketNumber", "title"],
      Filter: [{ op: "in", field: "id", value: ids }],
    });
    if (rows.length === 0) {
      return {
        attempted: false,
        sent: false,
        skipped: "Tickets nicht gefunden – keine Mail versendet.",
      };
    }

    const base = appBaseUrl();
    const orgName = await getOrgName();
    // Reihenfolge wie übergeben (stabile, erwartbare Liste).
    const byId = new Map(rows.map((r) => [r.id, r]));
    const tickets = ids
      .map((id) => byId.get(id))
      .filter((r): r is Ticket => !!r)
      .map((r) => ({
        ticketNumber: r.ticketNumber ?? `#${r.id}`,
        title: r.title ?? "",
        appUrl: base ? `${base}/tickets/${r.id}` : null,
        autotaskUrl: autotaskTicketUrl(r.id),
      }));

    const icons = loadAssignIcons();
    const { html, text, subject } = buildAssignmentEmail({
      assigneeFirstName: resource?.firstName ?? "",
      assignedByName,
      orgName,
      tickets,
      withIcons: !!icons,
    });

    const attachments = icons
      ? [
          {
            filename: ASSIGN_MAIL_ICONS.app.file,
            content: icons.app,
            contentId: ASSIGN_MAIL_ICONS.app.cid,
            contentType: "image/png",
          },
          {
            filename: ASSIGN_MAIL_ICONS.autotask.file,
            content: icons.at,
            contentId: ASSIGN_MAIL_ICONS.autotask.cid,
            contentType: "image/png",
          },
        ]
      : undefined;

    await sendMail({ to, subject, text, html, attachments });
    const recipientName =
      `${resource?.firstName ?? ""} ${resource?.lastName ?? ""}`.trim();
    return {
      attempted: true,
      sent: true,
      recipient: to,
      recipientName: recipientName || undefined,
      ticketCount: tickets.length,
    };
  } catch (e) {
    return {
      attempted: true,
      sent: false,
      error: e instanceof Error ? e.message : "Mailversand fehlgeschlagen.",
    };
  }
}
