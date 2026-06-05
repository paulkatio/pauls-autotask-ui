import { AlertCircleIcon } from "lucide-react";

import { getSession } from "@/lib/auth";
import { getCompaniesList } from "@/lib/autotask/entities/company-list";
import { AutotaskError } from "@/lib/autotask/client";
import { PageHeader } from "@/components/page-header";
import { CompaniesTable } from "@/components/companies/companies-table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

// /companies (B2): aktive Firmen mit Spalte „offene Tickets". Daten gebündelt +
// gecacht (company-list.ts); Filtern/Sortieren passiert clientseitig.
export default async function CompaniesPage() {
  const session = await getSession();
  if (!session) return null; // Layout erzwingt bereits Login.

  try {
    const { rows, companiesCapped, openCapped } = await getCompaniesList();

    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Firmen"
          description="Aktive Firmen – tippen zum Filtern, Spaltenkopf zum Sortieren."
        />
        <CompaniesTable
          rows={rows}
          companiesCapped={companiesCapped}
          openCapped={openCapped}
        />
      </div>
    );
  } catch (e) {
    const rateLimited = e instanceof AutotaskError && e.status === 429;
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>Firmen konnten nicht geladen werden</AlertTitle>
        <AlertDescription>
          {rateLimited
            ? "Rate-Limit erreicht (429). Bitte kurz warten und erneut versuchen."
            : "Bitte später erneut versuchen."}
        </AlertDescription>
      </Alert>
    );
  }
}
