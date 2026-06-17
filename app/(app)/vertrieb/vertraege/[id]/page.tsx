import { notFound } from "next/navigation";

import { getSession } from "@/lib/auth";
import { canAccessSales } from "@/lib/auth/sales-access";
import { contracts } from "@/lib/autotask/entities/contracts";
import { companies } from "@/lib/autotask/entities/companies";
import { loadOrError } from "@/lib/data/load-or-error";
import { DataError } from "@/components/data-error";
import { PageHeader } from "@/components/page-header";
import { VertriebBreadcrumb } from "@/components/vertrieb/vertrieb-breadcrumb";
import { ContractDetail } from "@/components/vertrieb/contract-detail";

export const dynamic = "force-dynamic";

export default async function VertragDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contractId = Number(id);
  if (!Number.isFinite(contractId)) notFound();

  const session = await getSession();
  if (!session) return null;
  if (!canAccessSales(session)) notFound(); // Gate vor jedem Datenabruf (Streaming-Leak).

  const res = await loadOrError(() => contracts.get(contractId));
  if (!res.ok)
    return (
      <DataError
        title="Vertrag konnte nicht geladen werden"
        rateLimited={res.rateLimited}
      />
    );
  const contract = res.data;
  if (!contract) notFound();

  let companyName: string | null = null;
  if (contract.companyID != null) {
    try {
      companyName = (await companies.get(contract.companyID))?.companyName ?? null;
    } catch {
      companyName = null;
    }
  }

  const name = contract.contractName ?? `Vertrag ${contractId}`;
  return (
    <div className="flex flex-col gap-4">
      <VertriebBreadcrumb
        listHref="/vertrieb/vertraege"
        listLabel="Verträge"
        current={contract.contractNumber || name}
      />
      <PageHeader title={name} />
      <ContractDetail contract={contract} companyName={companyName} />
    </div>
  );
}
