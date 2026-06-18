import { notFound } from "next/navigation";

import { getSession } from "@/lib/auth";
import { canAccessSales } from "@/lib/auth/sales-access";
import { invoices } from "@/lib/autotask/entities/invoices";
import { normalizeYear, yearWindowOf } from "@/lib/vertrieb/year-window";
import { currentMs } from "@/lib/format";
import { loadOrError } from "@/lib/data/load-or-error";
import { DataError } from "@/components/data-error";
import { VertriebTabs } from "@/components/vertrieb/vertrieb-tabs";
import { InvoicesList } from "@/components/vertrieb/invoices-list";

export const dynamic = "force-dynamic";

export default async function RechnungenPage({
  searchParams,
}: {
  searchParams: Promise<{ zeitraum?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  // Gate AUCH hier (nicht nur im Layout): verhindert, dass bei Streaming Daten in den
  // Response-Stream gelangen, bevor der Layout-Guard greift. Vor jedem Datenabruf.
  if (!canAccessSales(session)) notFound();

  // ?zeitraum= -> genau EIN Kalenderjahr (gte+lt) oder "alle". Default = aktuelles
  // Jahr. Server sortiert NICHT (DECISIONS B13) -> Client-Sort in der Liste.
  const { zeitraum } = await searchParams;
  const z = normalizeYear(zeitraum, new Date().getFullYear());
  const res = await loadOrError(() => invoices.list(yearWindowOf(z)));
  if (!res.ok)
    return (
      <DataError
        title="Rechnungen konnten nicht geladen werden"
        rateLimited={res.rateLimited}
      />
    );

  const { rows, capped, total } = res.data;
  const nowMs = currentMs();
  return (
    <div className="flex flex-col gap-6">
      <VertriebTabs heading="Rechnungen" />
      <InvoicesList
        rows={rows}
        capped={capped}
        total={total}
        zeitraum={z}
        nowMs={nowMs}
      />
    </div>
  );
}
