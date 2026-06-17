"use client";

import * as React from "react";
import { ReceiptEuroIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { TruncatedText } from "@/components/truncated-text";
import {
  formatCurrency,
  formatDate,
  monthKeyOf,
  monthLabelOf,
} from "@/lib/format";
import {
  deriveInvoiceStatus,
  invoiceStatusLabel,
  invoiceStatusVariant,
  type InvoiceUiStatus,
} from "@/lib/autotask/mappers";
import type { InvoiceRow } from "@/lib/autotask/entities/invoices";
import { GroupedList, type Grouping } from "@/components/vertrieb/grouped-list";
import { VertriebPeriodSelect } from "@/components/vertrieb/period-select";
import type { Column } from "@/components/searchable-table";

const STATUS_ORDER: InvoiceUiStatus[] = [
  "ueberfaellig",
  "offen",
  "bezahlt",
  "storniert",
];

export function InvoicesList({
  rows,
  capped,
  total,
  zeitraum,
  nowMs,
}: {
  rows: InvoiceRow[];
  capped: boolean;
  total: number;
  zeitraum: string;
  // „jetzt" wird von der (async) Seite gesetzt -> reine Render-Funktion (kein Date.now hier).
  nowMs: number;
}) {
  const st = React.useCallback(
    (r: InvoiceRow): InvoiceUiStatus => deriveInvoiceStatus(r, nowMs),
    [nowMs],
  );

  const columns: Column<InvoiceRow>[] = [
    {
      key: "number",
      header: "Nummer",
      sortValue: (r) => r.number,
      cellClassName: "font-medium tabular-nums whitespace-nowrap",
      cell: (r) => r.number,
    },
    {
      key: "company",
      header: "Firma",
      sortValue: (r) => r.companyName,
      cell: (r) => <TruncatedText className="max-w-xs">{r.companyName || "—"}</TruncatedText>,
    },
    {
      key: "date",
      header: "Datum",
      sortValue: (r) => r.date ?? "",
      cellClassName: "whitespace-nowrap tabular-nums",
      cell: (r) => formatDate(r.date),
    },
    {
      key: "due",
      header: "Fällig",
      sortValue: (r) => r.dueDate ?? "",
      cellClassName: "whitespace-nowrap tabular-nums",
      cell: (r) => formatDate(r.dueDate),
    },
    {
      key: "total",
      header: "Betrag",
      headClassName: "text-right",
      cellClassName: "text-right tabular-nums whitespace-nowrap",
      sortValue: (r) => r.total ?? null,
      cell: (r) => formatCurrency(r.total),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => invoiceStatusLabel(st(r)),
      cell: (r) => (
        <Badge variant={invoiceStatusVariant(st(r))}>
          {invoiceStatusLabel(st(r))}
        </Badge>
      ),
    },
  ];

  const mobileCard = (r: InvoiceRow) => (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium tabular-nums break-words">
          {r.number}
        </span>
        <Badge variant={invoiceStatusVariant(st(r))} className="shrink-0">
          {invoiceStatusLabel(st(r))}
        </Badge>
      </div>
      <div className="text-muted-foreground text-xs">
        {(r.companyName || "—") + " · " + formatDate(r.date)}
      </div>
      <div className="text-right text-sm font-medium tabular-nums">
        {formatCurrency(r.total)}
      </div>
    </>
  );

  const groupings: Grouping<InvoiceRow>[] = [
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
      sortGroups: (a, b) => b.key.localeCompare(a.key), // neueste Monate oben
    },
    {
      value: "status",
      label: "Status",
      keyOf: (r) => st(r),
      labelOf: (r) => invoiceStatusLabel(st(r)),
      sortGroups: (a, b) =>
        STATUS_ORDER.indexOf(a.key as InvoiceUiStatus) -
        STATUS_ORDER.indexOf(b.key as InvoiceUiStatus),
    },
  ];

  const note = capped ? (
    <span>
      Liste gekürzt: {total.toLocaleString("de-DE")} Rechnungen im Zeitraum. Über
      den Zeitraum-Filter eingrenzen, um alle zu sehen.
    </span>
  ) : null;

  return (
    <GroupedList
      rows={rows}
      columns={columns}
      searchText={(r) => `${r.number} ${r.companyName}`}
      searchPlaceholder="Rechnung oder Firma suchen…"
      mobileCard={mobileCard}
      hrefFor={(r) => `/vertrieb/rechnungen/${r.id}`}
      storageKey="vertrieb-rechnungen-cols"
      statePrefix="vertrieb:rechnungen"
      emptyIcon={<ReceiptEuroIcon />}
      emptyTitle="Keine Rechnungen"
      emptyDescription="Im gewählten Zeitraum gibt es keine Rechnungen."
      groupings={groupings}
      statusFilter={{
        options: [
          { value: "alle", label: "Alle" },
          { value: "offen", label: "Offen" },
          { value: "ueberfaellig", label: "Überfällig" },
          { value: "bezahlt", label: "Bezahlt" },
          { value: "storniert", label: "Storniert" },
        ],
        predicate: (r, v) => st(r) === v,
      }}
      toolbarExtra={<VertriebPeriodSelect value={zeitraum} />}
      note={note}
    />
  );
}
