import { notFound } from "next/navigation";

import { getSession } from "@/lib/auth";
import { canAccessSales } from "@/lib/auth/sales-access";
import { quotes } from "@/lib/autotask/entities/quotes";
import { normalizeYear, yearWindowOf } from "@/lib/vertrieb/year-window";
import { loadOrError } from "@/lib/data/load-or-error";
import { DataError } from "@/components/data-error";
import { QuotesList } from "@/components/vertrieb/quotes-list";

export const dynamic = "force-dynamic";

export default async function AngebotePage({
  searchParams,
}: {
  searchParams: Promise<{ zeitraum?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  if (!canAccessSales(session)) notFound(); // Gate vor jedem Datenabruf (Streaming-Leak).

  // ?zeitraum= -> genau EIN Kalenderjahr (gte+lt) oder "alle". Default = aktuelles Jahr.
  const { zeitraum } = await searchParams;
  const z = normalizeYear(zeitraum, new Date().getFullYear());
  const res = await loadOrError(() => quotes.list(yearWindowOf(z)));
  if (!res.ok)
    return (
      <DataError
        title="Angebote konnten nicht geladen werden"
        rateLimited={res.rateLimited}
      />
    );

  const { rows, capped, total } = res.data;
  // Tab-Leiste liefert das Section-Layout; hier nur der Inhalt.
  return <QuotesList rows={rows} capped={capped} total={total} zeitraum={z} />;
}
