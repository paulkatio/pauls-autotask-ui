import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import {
  contractCategoryLabel,
  contractStatusLabel,
  contractStatusVariant,
  contractTypeLabel,
} from "@/lib/autotask/mappers";
import type { Contract } from "@/lib/autotask/entities/contracts";
import { Field, FieldGrid } from "@/components/vertrieb/detail-rail";

export function ContractDetail({
  contract,
  companyName,
}: {
  contract: Contract;
  companyName: string | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      <FieldGrid>
        <Field label="Firma">
          {contract.companyID != null ? (
            <Link
              href={`/companies/${contract.companyID}`}
              className="hover:underline"
            >
              {companyName ?? `Firma ${contract.companyID}`}
            </Link>
          ) : (
            "—"
          )}
        </Field>
        <Field label="Vertragsnummer">{contract.contractNumber || "—"}</Field>
        <Field label="Status">
          <Badge variant={contractStatusVariant(contract.status)}>
            {contractStatusLabel(contract.status)}
          </Badge>
        </Field>
        <Field label="Beginn">{formatDate(contract.startDate)}</Field>
        <Field label="Ende">{formatDate(contract.endDate)}</Field>
        <Field label="Kategorie">
          {contractCategoryLabel(contract.contractCategory)}
        </Field>
        <Field label="Typ">{contractTypeLabel(contract.contractType)}</Field>
        {contract.description ? (
          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="Beschreibung">{contract.description}</Field>
          </div>
        ) : null}
      </FieldGrid>
    </div>
  );
}
