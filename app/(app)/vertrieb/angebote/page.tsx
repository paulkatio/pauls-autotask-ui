import { notFound } from "next/navigation";

import { getSession } from "@/lib/auth";
import { canAccessSales } from "@/lib/auth/sales-access";
import { quotes, defaultWindowStartISO } from "@/lib/autotask/entities/quotes";
import { loadOrError } from "@/lib/data/load-or-error";
import { DataError } from "@/components/data-error";
import { VertriebTabs } from "@/components/vertrieb/vertrieb-tabs";
import { QuotesList } from "@/components/vertrieb/quotes-list";

export const dynamic = "force-dynamic";

function sinceFrom(zeitraum: string | undefined): string | null {
  if (zeitraum === "alle") return null;
  if (zeitraum && /^\d{4}$/.test(zeitraum)) return `${zeitraum}-01-01T00:00:00`;
  return defaultWindowStartISO(Date.now());
}

export default async function AngebotePage({
  searchParams,
}: {
  searchParams: Promise<{ zeitraum?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  if (!canAccessSales(session)) notFound(); // Gate vor jedem Datenabruf (Streaming-Leak).

  const { zeitraum } = await searchParams;
  const z = typeof zeitraum === "string" ? zeitraum : "standard";
  const res = await loadOrError(() => quotes.list(sinceFrom(z)));
  if (!res.ok)
    return (
      <DataError
        title="Angebote konnten nicht geladen werden"
        rateLimited={res.rateLimited}
      />
    );

  const { rows, capped, total } = res.data;
  return (
    <div className="flex flex-col gap-6">
      <VertriebTabs heading="Angebote" />
      <QuotesList rows={rows} capped={capped} total={total} zeitraum={z} />
    </div>
  );
}
