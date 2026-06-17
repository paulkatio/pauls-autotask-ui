import { notFound } from "next/navigation";

import { getSession } from "@/lib/auth";
import { canAccessSales } from "@/lib/auth/sales-access";
import { invoices, defaultWindowStartISO } from "@/lib/autotask/entities/invoices";
import { currentMs } from "@/lib/format";
import { loadOrError } from "@/lib/data/load-or-error";
import { DataError } from "@/components/data-error";
import { VertriebTabs } from "@/components/vertrieb/vertrieb-tabs";
import { InvoicesList } from "@/components/vertrieb/invoices-list";

export const dynamic = "force-dynamic";

// ?zeitraum= -> Server-Zeitfenster (Server sortiert NICHT, DECISIONS B13/2026-06-17):
// "alle" = ungefiltert (gecappt), "JJJJ" = seit Jahresanfang, sonst Default (seit Vorjahr).
function sinceFrom(zeitraum: string | undefined): string | null {
  if (zeitraum === "alle") return null;
  if (zeitraum && /^\d{4}$/.test(zeitraum)) return `${zeitraum}-01-01T00:00:00`;
  return defaultWindowStartISO(Date.now());
}

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

  const { zeitraum } = await searchParams;
  const z = typeof zeitraum === "string" ? zeitraum : "standard";
  const res = await loadOrError(() => invoices.list(sinceFrom(z)));
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
