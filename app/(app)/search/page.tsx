import { AlertCircleIcon } from "lucide-react";

import { getSession } from "@/lib/auth";
import { searchColumnPage } from "@/lib/autotask/entities/search";
import { AutotaskError } from "@/lib/autotask/client";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { SearchBox } from "@/components/search/search-box";
import { SearchColumns } from "@/components/search/search-columns";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

function isRateLimited(e: unknown): boolean {
  return e instanceof AutotaskError && e.status === 429;
}

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
    try {
      // Erste Seite je Spalte parallel (inkl. Gesamtzahl); „Mehr laden" lädt clientseitig.
      const [firma, kontakt, ticketName, ticketNummer] = await Promise.all([
        searchColumnPage("firma", query),
        searchColumnPage("kontakt", query),
        searchColumnPage("ticket-name", query),
        searchColumnPage("ticket-nummer", query),
      ]);
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
    } catch (e) {
      body = (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Suche fehlgeschlagen</AlertTitle>
          <AlertDescription>
            {isRateLimited(e)
              ? "Rate-Limit erreicht (429). Bitte kurz warten und erneut versuchen."
              : "Bitte später erneut versuchen."}
          </AlertDescription>
        </Alert>
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
