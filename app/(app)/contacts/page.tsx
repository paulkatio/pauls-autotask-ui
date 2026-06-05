import { AlertCircleIcon } from "lucide-react";

import { getSession } from "@/lib/auth";
import { getContactsList } from "@/lib/autotask/entities/contact-list";
import { AutotaskError } from "@/lib/autotask/client";
import { PageHeader } from "@/components/page-header";
import { ContactsTable } from "@/components/contacts/contacts-table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

// /contacts (B4): aktive Kontakte (erste Seite) mit serverseitiger contains-Suche
// (Vor-/Nachname) und clientseitiger Sortierung.
export default async function ContactsPage() {
  const session = await getSession();
  if (!session) return null; // Layout erzwingt bereits Login.

  try {
    const initial = await getContactsList();
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Kontakte"
          description="Aktive Kontakte – tippen zum Suchen (Vor-/Nachname), Spaltenkopf zum Sortieren."
        />
        <ContactsTable initial={initial} />
      </div>
    );
  } catch (e) {
    const rateLimited = e instanceof AutotaskError && e.status === 429;
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>Kontakte konnten nicht geladen werden</AlertTitle>
        <AlertDescription>
          {rateLimited
            ? "Rate-Limit erreicht (429). Bitte kurz warten und erneut versuchen."
            : "Bitte später erneut versuchen."}
        </AlertDescription>
      </Alert>
    );
  }
}
