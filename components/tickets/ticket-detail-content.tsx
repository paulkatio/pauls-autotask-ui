import type { Metadata } from "next";
import { AlertCircleIcon } from "lucide-react";

import { getSession } from "@/lib/auth";
import { getTicketDetail } from "@/lib/autotask/entities/ticket-detail";
import { tickets } from "@/lib/autotask/entities/tickets";
import { resources } from "@/lib/autotask/entities/resources";
import {
  getTicketPicklists,
  getNotePicklists,
} from "@/lib/autotask/entities/picklists";
import { AutotaskError } from "@/lib/autotask/client";
import { autotaskTicketUrl } from "@/lib/autotask/links";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { TicketDetailView } from "@/components/tickets/ticket-detail";

// Gemeinsamer Ticketdetail-Inhalt für die normale Seite (`app/(app)/tickets/[id]`)
// UND das sidebar-lose Popup-Fenster (`app/popup/tickets/[id]`). Eine Quelle.

function ErrorAlert({ title, message }: { title: string; message: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export async function TicketDetailContent({
  id,
  popout = false,
}: {
  id: number;
  // Im Pop-out-Fenster gibt es KEINEN globalen Header → der mobile
  // „In Autotask öffnen"-Knopf wird dann direkt im Detail gezeigt.
  popout?: boolean;
}) {
  const session = await getSession();
  if (!session) return null;
  if (!Number.isFinite(id)) {
    return <ErrorAlert title="Ungültige Ticket-ID" message="Bitte prüfe den Link." />;
  }

  const [picklists, notePicklists, resourceOptions] = await Promise.all([
    getTicketPicklists(),
    getNotePicklists(),
    resources.listActive(),
  ]);

  try {
    const detail = await getTicketDetail(id);
    if (!detail) {
      return (
        <ErrorAlert
          title="Ticket nicht gefunden"
          message={`Zur ID ${id} existiert kein Ticket.`}
        />
      );
    }
    return (
      <TicketDetailView
        detail={detail}
        picklists={picklists}
        notePicklists={notePicklists}
        resourceOptions={resourceOptions}
        me={{ name: session.displayName, avatar: session.avatarUrl ?? "" }}
        autotaskUrl={autotaskTicketUrl(id)}
        showMobileAutotaskButton={popout}
      />
    );
  } catch (e) {
    const rateLimited = e instanceof AutotaskError && e.status === 429;
    return (
      <ErrorAlert
        title="Ticket konnte nicht geladen werden"
        message={
          rateLimited
            ? "Rate-Limit erreicht (429). Bitte kurz warten und erneut versuchen."
            : "Bitte später erneut versuchen."
        }
      />
    );
  }
}

// Dokumenttitel (Browser-Tab / Taskleiste des Popup-Fensters) = Ticketnummer + Titel.
// Leichte Einzelabfrage (nur id/ticketNumber/title).
export async function ticketMetadata(id: number): Promise<Metadata> {
  if (!Number.isFinite(id)) return { title: "Ticket" };
  try {
    const rows = await tickets.query([{ op: "eq", field: "id", value: id }], {
      fields: ["id", "ticketNumber", "title"],
      maxRecords: 1,
      autoPage: false,
    });
    const t = rows[0];
    if (!t) return { title: `T - Ticket #${id}` };
    // Fenster-/Taskleisten-Titel: „T - " + Ticket-Titel, damit erkennbar ist, dass
    // es ein Ticket ist (Paul). Nummer nur als Fallback ohne Titel.
    const title = (t.title ?? "").trim() || t.ticketNumber || `Ticket #${id}`;
    return { title: `T - ${title}` };
  } catch {
    return { title: `Ticket #${id}` };
  }
}
