import { notFound } from "next/navigation";

import { getSession } from "@/lib/auth";
import { canAccessSales } from "@/lib/auth/sales-access";
import { contracts } from "@/lib/autotask/entities/contracts";
import { loadOrError } from "@/lib/data/load-or-error";
import { DataError } from "@/components/data-error";
import { VertriebTabs } from "@/components/vertrieb/vertrieb-tabs";
import { ContractsList } from "@/components/vertrieb/contracts-list";

export const dynamic = "force-dynamic";

export default async function VertraegePage() {
  const session = await getSession();
  if (!session) return null;
  if (!canAccessSales(session)) notFound(); // Gate vor jedem Datenabruf (Streaming-Leak).

  const res = await loadOrError(() => contracts.listAll());
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
      <ContractsList rows={res.data.rows} />
    </div>
  );
}
