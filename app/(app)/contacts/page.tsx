import { getSession } from "@/lib/auth";
import { getContactsList } from "@/lib/autotask/entities/contact-list";
import { loadOrError } from "@/lib/data/load-or-error";
import { DataError } from "@/components/data-error";
import { PageHeader } from "@/components/page-header";
import { ContactsTable } from "@/components/contacts/contacts-table";

export const dynamic = "force-dynamic";

// /contacts (B4): aktive Kontakte (erste Seite) mit serverseitiger contains-Suche
// (Vor-/Nachname) und clientseitiger Sortierung.
export default async function ContactsPage() {
  const session = await getSession();
  if (!session) return null; // Layout erzwingt bereits Login.

  const res = await loadOrError(() => getContactsList());
  if (!res.ok)
    return (
      <DataError
        title="Kontakte konnten nicht geladen werden"
        rateLimited={res.rateLimited}
      />
    );
  const initial = res.data;
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Kontakte"
          description="Aktive Kontakte – tippen zum Suchen (Vor-/Nachname), Spaltenkopf zum Sortieren."
        />
        <ContactsTable initial={initial} />
      </div>
    );
}
