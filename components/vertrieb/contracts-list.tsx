"use client";

import { FileText, FunnelSimple } from "@phosphor-icons/react/ssr";

import { Badge } from "@/components/ui/badge";
import { TruncatedText } from "@/components/truncated-text";
import { formatDate } from "@/lib/format";
import {
  contractStatusLabel,
  contractStatusVariant,
  contractTypeLabel,
} from "@/lib/autotask/mappers";
import type { ContractListRow } from "@/lib/autotask/entities/contracts";
import {
  GroupedList,
  type FilterDef,
  type Grouping,
} from "@/components/vertrieb/grouped-list";
import { VertriebPeriodSelect } from "@/components/vertrieb/period-select";
import type { Column } from "@/components/searchable-table";

function laufzeit(r: ContractListRow): string {
  if (!r.startDate && !r.endDate) return "—";
  return `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`;
}

export function ContractsList({
  rows,
  zeitraum,
}: {
  rows: ContractListRow[];
  zeitraum: string;
}) {
  const columns: Column<ContractListRow>[] = [
    {
      key: "name",
      header: "Vertrag",
      width: "w-[28%]",
      sortValue: (r) => r.name,
      cellClassName: "font-medium",
      cell: (r) => <TruncatedText>{r.name}</TruncatedText>,
    },
    {
      key: "company",
      header: "Firma",
      width: "w-[26%]",
      sortValue: (r) => r.companyName,
      cell: (r) => <TruncatedText>{r.companyName || "—"}</TruncatedText>,
    },
    {
      key: "type",
      header: "Typ",
      width: "w-[12%]",
      sortValue: (r) => contractTypeLabel(r.type),
      cellClassName: "whitespace-nowrap",
      cell: (r) => contractTypeLabel(r.type),
    },
    {
      key: "zeitraum",
      header: "Zeitraum",
      width: "w-[20%]",
      sortValue: (r) => r.startDate ?? "",
      cellClassName: "whitespace-nowrap tabular-nums",
      cell: (r) => laufzeit(r),
    },
    {
      key: "status",
      header: "Status",
      width: "w-[14%]",
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
        {laufzeit(r)}
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
      emptyIcon={<FileText />}
      emptyTitle="Keine Verträge"
      emptyDescription="Im gewählten Zeitraum gibt es keine Verträge."
      groupings={groupings}
      filters={[
        {
          id: "status",
          label: "Status",
          icon: <FunnelSimple className="text-muted-foreground" />,
          options: [
            { value: "alle", label: "Alle" },
            { value: "1", label: "Aktiv" },
            { value: "0", label: "Inaktiv" },
          ],
          predicate: (r, v) => String(r.status ?? "") === v,
        } satisfies FilterDef<ContractListRow>,
      ]}
      toolbarExtra={<VertriebPeriodSelect value={zeitraum} />}
      scopeLabel="Zeitraum"
    />
  );
}
