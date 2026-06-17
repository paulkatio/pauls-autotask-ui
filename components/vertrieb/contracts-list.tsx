"use client";

import { FileTextIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { TruncatedText } from "@/components/truncated-text";
import { formatDate } from "@/lib/format";
import {
  contractStatusLabel,
  contractStatusVariant,
  contractTypeLabel,
} from "@/lib/autotask/mappers";
import type { ContractListRow } from "@/lib/autotask/entities/contracts";
import { GroupedList, type Grouping } from "@/components/vertrieb/grouped-list";
import type { Column } from "@/components/searchable-table";

function zeitraum(r: ContractListRow): string {
  if (!r.startDate && !r.endDate) return "—";
  return `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`;
}

export function ContractsList({ rows }: { rows: ContractListRow[] }) {
  const columns: Column<ContractListRow>[] = [
    {
      key: "name",
      header: "Vertrag",
      sortValue: (r) => r.name,
      cellClassName: "font-medium",
      cell: (r) => <TruncatedText className="max-w-xs">{r.name}</TruncatedText>,
    },
    {
      key: "company",
      header: "Firma",
      sortValue: (r) => r.companyName,
      cell: (r) => <TruncatedText className="max-w-xs">{r.companyName || "—"}</TruncatedText>,
    },
    {
      key: "type",
      header: "Typ",
      sortValue: (r) => contractTypeLabel(r.type),
      cellClassName: "whitespace-nowrap",
      cell: (r) => contractTypeLabel(r.type),
    },
    {
      key: "zeitraum",
      header: "Zeitraum",
      sortValue: (r) => r.startDate ?? "",
      cellClassName: "whitespace-nowrap tabular-nums",
      cell: (r) => zeitraum(r),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => contractStatusLabel(r.status),
      cell: (r) => (
        <Badge variant={contractStatusVariant(r.status)}>
          {contractStatusLabel(r.status)}
        </Badge>
      ),
    },
  ];

  const mobileCard = (r: ContractListRow) => (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium break-words">{r.name}</span>
        <Badge variant={contractStatusVariant(r.status)} className="shrink-0">
          {contractStatusLabel(r.status)}
        </Badge>
      </div>
      <div className="text-muted-foreground text-xs">{r.companyName || "—"}</div>
      <div className="text-muted-foreground text-xs tabular-nums">
        {zeitraum(r)}
      </div>
    </>
  );

  const groupings: Grouping<ContractListRow>[] = [
    {
      value: "company",
      label: "Firma",
      keyOf: (r) => r.companyName || "—",
      labelOf: (r) => r.companyName || "Ohne Firma",
    },
    {
      value: "status",
      label: "Status",
      keyOf: (r) => String(r.status ?? ""),
      labelOf: (r) => contractStatusLabel(r.status),
      sortGroups: (a, b) => a.label.localeCompare(b.label, "de"),
    },
  ];

  return (
    <GroupedList
      rows={rows}
      columns={columns}
      searchText={(r) => `${r.name} ${r.number} ${r.companyName}`}
      searchPlaceholder="Vertrag oder Firma suchen…"
      mobileCard={mobileCard}
      hrefFor={(r) => `/vertrieb/vertraege/${r.id}`}
      storageKey="vertrieb-vertraege-cols"
      statePrefix="vertrieb:vertraege"
      emptyIcon={<FileTextIcon />}
      emptyTitle="Keine Verträge"
      emptyDescription="Es sind keine Verträge vorhanden."
      groupings={groupings}
      statusFilter={{
        options: [
          { value: "alle", label: "Alle" },
          { value: "1", label: "Aktiv" },
          { value: "0", label: "Inaktiv" },
        ],
        predicate: (r, v) => String(r.status ?? "") === v,
      }}
    />
  );
}
