import { toast } from "sonner";

// Client-Helfer rund um die Zuweisungs-Mail. Die EINZEL-Zuweisung löst die Mail
// serverseitig in der PATCH-Route aus (robust, unabhängig vom Client-Bundle); der
// Status kommt in der PATCH-Antwort zurück und wird hier per Toast gemeldet. Die
// BULK-Zuweisung ruft den Endpoint direkt auf (gebündelte Mail).

export interface AssignMailStatus {
  attempted?: boolean;
  sent?: boolean;
  recipient?: string;
  recipientName?: string;
  ticketCount?: number;
  skipped?: string;
  error?: string;
}

// Meldet den Mailstatus dezent per Toast: kurz „<Name> wurde per E-Mail
// benachrichtigt." (bzw. Fehler/übersprungen).
export function toastAssignMail(m: AssignMailStatus | undefined | null): void {
  if (!m) return;
  if (m.sent) {
    const who = m.recipientName?.trim();
    toast.success(
      who ? `${who} wurde per E-Mail benachrichtigt.` : "Wurde benachrichtigt.",
    );
  } else if (m.error) {
    toast.warning(`Zuweisungs-Mail nicht gesendet: ${m.error}`);
  } else if (m.skipped) {
    toast.message(`Keine Zuweisungs-Mail: ${m.skipped}`);
  }
}

// Bulk: gebündelte Zuweisungs-Mail über den Endpoint anstoßen (fire-and-forget).
export async function sendAssignmentMail(
  resourceId: number,
  ticketIds: number[],
): Promise<void> {
  if (!Number.isFinite(resourceId) || ticketIds.length === 0) return;
  try {
    const res = await fetch("/api/tickets/notify-assignment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceId, ticketIds }),
    });
    const j = (await res.json().catch(() => ({}))) as AssignMailStatus & {
      error?: string;
    };
    if (!res.ok) {
      toast.warning(
        `Zuweisungs-Mail nicht gesendet: ${j.error ?? `Fehler (${res.status}).`}`,
      );
      return;
    }
    toastAssignMail(j);
  } catch (e) {
    toast.warning(
      `Zuweisungs-Mail nicht gesendet: ${e instanceof Error ? e.message : "Netzwerkfehler."}`,
    );
  }
}
