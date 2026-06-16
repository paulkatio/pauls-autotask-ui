import { getSession } from "@/lib/auth";
import { getCompaniesList } from "@/lib/autotask/entities/company-list";
import { loadOrError } from "@/lib/data/load-or-error";
import { DataError } from "@/components/data-error";
import { PageHeader } from "@/components/page-header";
import { CompaniesTable } from "@/components/companies/companies-table";

export const dynamic = "force-dynamic";

// /companies (B2): aktive Firmen mit Spalte „offene Tickets". Daten gebündelt +
// gecacht (company-list.ts); Filtern/Sortieren passiert clientseitig.
export default async function CompaniesPage() {
  const session = await getSession();
  if (!session) return null; // Layout erzwingt bereits Login.

  const res = await loadOrError(() => getCompaniesList());
  if (!res.ok)
    return (
      <DataError
        title="Firmen konnten nicht geladen werden"
        rateLimited={res.rateLimited}
      />
    );
  const { rows, companiesCapped, openCapped } = res.data;

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
}
