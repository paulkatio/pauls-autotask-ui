import { notFound } from "next/navigation";

import { getSession } from "@/lib/auth";
import { canAccessSales } from "@/lib/auth/sales-access";
import { contracts } from "@/lib/autotask/entities/contracts";
import { normalizeYear, yearWindowOf } from "@/lib/vertrieb/year-window";
import { loadOrError } from "@/lib/data/load-or-error";
import { DataError } from "@/components/data-error";
import { VertriebTabs } from "@/components/vertrieb/vertrieb-tabs";
import { ContractsList } from "@/components/vertrieb/contracts-list";

export const dynamic = "force-dynamic";

export default async function VertraegePage({
  searchParams,
}: {
  searchParams: Promise<{ zeitraum?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;
  if (!canAccessSales(session)) notFound(); // Gate vor jedem Datenabruf (Streaming-Leak).

  // ?zeitraum= -> Verträge mit Beginn (startDate) genau in diesem Kalenderjahr,
  // oder "alle". Default = aktuelles Jahr.
  const { zeitraum } = await searchParams;
  const z = normalizeYear(zeitraum, new Date().getFullYear());
  const res = await loadOrError(() => contracts.list(yearWindowOf(z)));
  if (!res.ok)
    return (
      <DataError
        title="Verträge konnten nicht geladen werden"
        rateLimited={res.rateLimited}
      />
    );

  return (
    <div className="flex flex-col gap-6">
      <VertriebTabs heading="Verträge" />
      <ContractsList rows={res.data.rows} zeitraum={z} />
    </div>
  );
}
