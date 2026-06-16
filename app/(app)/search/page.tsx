import { getSession } from "@/lib/auth";
import { searchColumnPage } from "@/lib/autotask/entities/search";
import { loadOrError } from "@/lib/data/load-or-error";
import { DataError } from "@/components/data-error";
import { SearchBox } from "@/components/search/search-box";
import { SearchColumns } from "@/components/search/search-columns";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  if (!session) return null;
  const query = (sp.q ?? "").trim();

  let body: React.ReactNode;
  if (query === "") {
    body = (
      <p className="text-muted-foreground text-sm">
        Gib eine Ticketnummer, einen Titel, eine Firma oder einen Kontakt ein –
        es wird gleichzeitig in allen vier Spalten gesucht.
      </p>
    );
  } else {
    // Erste Seite je Spalte parallel (inkl. Gesamtzahl); „Mehr laden" lädt clientseitig.
    const res = await loadOrError(() =>
      Promise.all([
        searchColumnPage("firma", query),
        searchColumnPage("kontakt", query),
        searchColumnPage("ticket-name", query),
        searchColumnPage("ticket-nummer", query),
      ]),
    );
    if (!res.ok) {
      body = (
        <DataError title="Suche fehlgeschlagen" rateLimited={res.rateLimited} />
      );
    } else {
      const [firma, kontakt, ticketName, ticketNummer] = res.data;
      body = (
        <SearchColumns
          query={query}
          initial={{
            firma,
            kontakt,
            "ticket-name": ticketName,
            "ticket-nummer": ticketNummer,
          }}
        />
      );
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Suche"
        description="Tickets, Firmen und Kontakte gleichzeitig durchsuchen."
      />
      <SearchBox />
      {body}
    </div>
  );
}
