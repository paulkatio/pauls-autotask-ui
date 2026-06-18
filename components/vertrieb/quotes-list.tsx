"use client";

import { Signature, FunnelSimple } from "@phosphor-icons/react/ssr";

import { Badge } from "@/components/ui/badge";
import { TruncatedText } from "@/components/truncated-text";
import { formatDate, monthKeyOf, monthLabelOf } from "@/lib/format";
import { quoteStatusLabel, quoteStatusVariant } from "@/lib/autotask/mappers";
import type { QuoteRow } from "@/lib/autotask/entities/quotes";
import {
  GroupedList,
  type FilterDef,
  type Grouping,
} from "@/components/vertrieb/grouped-list";
import { VertriebPeriodSelect } from "@/components/vertrieb/period-select";
import type { Column } from "@/components/searchable-table";

const STATUS_ORDER = [2, 1, 3, 4]; // Warten, Nicht angefordert, Genehmigt, Abgelehnt

export function QuotesList({
  rows,
  capped,
  total,
  zeitraum,
}: {
  rows: QuoteRow[];
  capped: boolean;
  total: number;
  zeitraum: string;
}) {
  const columns: Column<QuoteRow>[] = [
    {
      key: "number",
      header: "Nummer",
      width: "w-[9%]",
      sortValue: (r) => r.number,
      cellClassName: "font-medium tabular-nums whitespace-nowrap",
      cell: (r) => r.number,
    },
    {
      key: "name",
      header: "Bezeichnung",
      width: "w-[22%]",
      sortValue: (r) => r.name,
      cell: (r) => <TruncatedText>{r.name}</TruncatedText>,
    },
    {
      key: "company",
      header: "Firma",
      width: "w-[19%]",
      sortValue: (r) => r.companyName,
      cell: (r) => <TruncatedText>{r.companyName || "—"}</TruncatedText>,
    },
    {
      key: "date",
      header: "Datum",
      width: "w-[10%]",
      sortValue: (r) => r.date ?? "",
      cellClassName: "whitespace-nowrap tabular-nums",
      cell: (r) => formatDate(r.date),
    },
    {
      key: "expires",
      header: "Gültig bis",
      width: "w-[10%]",
      sortValue: (r) => r.expirationDate ?? "",
      cellClassName: "whitespace-nowrap tabular-nums",
      cell: (r) => formatDate(r.expirationDate),
    },
    {
      key: "creator",
      header: "Erstellt von",
      width: "w-[14%]",
      sortValue: (r) => r.creatorName,
      cell: (r) => <TruncatedText>{r.creatorName || "—"}</TruncatedText>,
    },
    {
      key: "status",
      header: "Status",
      width: "w-[16%]",
      sortValue: (r) => quoteStatusLabel(r.approvalStatus),
      cell: (r) => (
        <Badge variant={quoteStatusVariant(r.approvalStatus)}>
          {quoteStatusLabel(r.approvalStatus)}
        </Badge>
      ),
    },
  ];

  const mobileCard = (r: QuoteRow) => (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium break-words">{r.name}</span>
        <Badge variant={quoteStatusVariant(r.approvalStatus)} className="shrink-0">
          {quoteStatusLabel(r.approvalStatus)}
        </Badge>
      </div>
      <div className="text-muted-foreground text-xs">
        {`Nr. ${r.number} · ${r.companyName || "—"} · ${formatDate(r.date)}`}
      </div>
      {r.creatorName && (
        <div className="text-muted-foreground text-xs">
          Erstellt von {r.creatorName}
        </div>
      )}
    </>
  );

  const groupings: Grouping<QuoteRow>[] = [
    {
      value: "company",
      label: "Firma",
      keyOf: (r) => r.companyName || "—",
      labelOf: (r) => r.companyName || "Ohne Firma",
    },
    {
      value: "month",
      label: "Monat",
      keyOf: (r) => monthKeyOf(r.date) || "0000-00",
      labelOf: (r) => monthLabelOf(r.date),
      sortGroups: (a, b) => b.key.localeCompare(a.key),
    },
    {
      value: "status",
      label: "Status",
      keyOf: (r) => String(r.approvalStatus ?? ""),
      labelOf: (r) => quoteStatusLabel(r.approvalStatus),
      sortGroups: (a, b) =>
        STATUS_ORDER.indexOf(Number(a.key)) - STATUS_ORDER.indexOf(Number(b.key)),
    },
  ];

  const note = capped ? (
    <span>
      Liste gekürzt: {total.toLocaleString("de-DE")} Angebote im Zeitraum. Über
      den Zeitraum-Filter eingrenzen, um alle zu sehen.
    </span>
  ) : null;

  return (
    <GroupedList
      rows={rows}
      columns={columns}
      searchText={(r) => `${r.number} ${r.name} ${r.companyName}`}
      searchPlaceholder="Angebot oder Firma suchen…"
      mobileCard={mobileCard}
      hrefFor={(r) => `/vertrieb/angebote/${r.id}`}
      storageKey="vertrieb-angebote-cols"
      statePrefix="vertrieb:angebote"
      minWidthClass="min-w-4xl"
      emptyIcon={<Signature />}
      emptyTitle="Keine Angebote"
      emptyDescription="Im gewählten Zeitraum gibt es keine Angebote."
      groupings={groupings}
      filters={[
        {
          id: "status",
          label: "Status",
          icon: <FunnelSimple className="text-muted-foreground" />,
          options: [
            { value: "alle", label: "Alle" },
            { value: "1", label: "Nicht angefordert" },
            { value: "2", label: "Warten auf Genehmigung" },
            { value: "3", label: "Genehmigt" },
            { value: "4", label: "Abgelehnt" },
          ],
          predicate: (r, v) => String(r.approvalStatus ?? "") === v,
        } satisfies FilterDef<QuoteRow>,
      ]}
      toolbarExtra={<VertriebPeriodSelect value={zeitraum} />}
      scopeLabel="Zeitraum"
      note={note}
    />
  );
}
