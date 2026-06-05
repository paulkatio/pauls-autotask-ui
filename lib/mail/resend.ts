import "server-only";

// Server-only Resend-Versand über die REST-API (kein npm-Paket nötig).
// Secrets bleiben serverseitig: RESEND_API_KEY/RESEND_FROM tauchen nie im
// Client-Bundle oder in API-Antworten an den Browser auf.

export interface SendMailArgs {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

// Resend ist nur dann nutzbar, wenn Key + Absender gesetzt sind.
export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

// Sendet eine Mail. Wirft bei fehlender Konfig oder Nicht-2xx-Antwort.
// Reply-To = AUTOTASK_INBOUND_MAILBOX (Autotask-Eingangspostfach) für Threading.
export async function sendMail({
  to,
  subject,
  text,
  html,
}: SendMailArgs): Promise<{ id: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) {
    throw new Error("Resend nicht konfiguriert (RESEND_API_KEY/RESEND_FROM).");
  }
  const replyTo = process.env.AUTOTASK_INBOUND_MAILBOX?.trim();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject,
      text,
      ...(html ? { html } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`);
  }
  const j = (await res.json().catch(() => ({}))) as { id?: string };
  return { id: j.id ?? "" };
}
