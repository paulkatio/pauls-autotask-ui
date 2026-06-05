import { AlertCircleIcon } from "lucide-react";

import { getSession } from "@/lib/auth";
import { getTicketDetail } from "@/lib/autotask/entities/ticket-detail";
import { resources } from "@/lib/autotask/entities/resources";
import {
  getTicketPicklists,
  getNotePicklists,
} from "@/lib/autotask/entities/picklists";
import { AutotaskError } from "@/lib/autotask/client";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { TicketDetailView } from "@/components/tickets/ticket-detail";

export const dynamic = "force-dynamic";

function ErrorAlert({ title, message }: { title: string; message: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return null;

  const num = Number(id);
  if (!Number.isFinite(num)) {
    return <ErrorAlert title="Ungültige Ticket-ID" message="Bitte prüfe den Link." />;
  }

  const [picklists, notePicklists, resourceOptions] = await Promise.all([
    getTicketPicklists(),
    getNotePicklists(),
    resources.listActive(),
  ]);

  try {
    const detail = await getTicketDetail(num);
    if (!detail) {
      return (
        <ErrorAlert
          title="Ticket nicht gefunden"
          message={`Zur ID ${num} existiert kein Ticket.`}
        />
      );
    }
    return (
      <TicketDetailView
        detail={detail}
        picklists={picklists}
        notePicklists={notePicklists}
        resourceOptions={resourceOptions}
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
