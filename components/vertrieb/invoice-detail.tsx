import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  deriveInvoiceStatus,
  invoiceStatusLabel,
  invoiceStatusVariant,
  paymentTermLabel,
} from "@/lib/autotask/mappers";
import type { Invoice } from "@/lib/autotask/entities/invoices";
import type { InvoiceLineRow } from "@/lib/autotask/entities/billing-items";
import { Field, FieldGrid, PositionsTable } from "@/components/vertrieb/detail-rail";

export function InvoiceDetail({
  invoice,
  companyName,
  lines,
  nowMs,
}: {
  invoice: Invoice;
  companyName: string | null;
  lines: InvoiceLineRow[];
  // „jetzt" von der (async) Seite -> reine Render-Funktion (kein Date.now hier).
  nowMs: number;
}) {
  const status = deriveInvoiceStatus(invoice, nowMs);
  const netSum = lines.reduce((s, l) => s + (l.total ?? 0), 0);
  const leistungszeitraum =
    invoice.fromDate || invoice.toDate
      ? `${formatDate(invoice.fromDate)} – ${formatDate(invoice.toDate)}`
      : "—";

  return (
    <div className="flex flex-col gap-6">
      <FieldGrid>
        <Field label="Firma">
          {invoice.companyID != null ? (
            <Link
              href={`/companies/${invoice.companyID}`}
              className="hover:underline"
            >
              {companyName ?? `Firma ${invoice.companyID}`}
            </Link>
          ) : (
            "—"
          )}
        </Field>
        <Field label="Status">
          <Badge variant={invoiceStatusVariant(status)}>
            {invoiceStatusLabel(status)}
          </Badge>
        </Field>
        <Field label="Betrag (brutto)">
          {formatCurrency(invoice.invoiceTotal)}
        </Field>
        <Field label="Rechnungsdatum">{formatDate(invoice.invoiceDateTime)}</Field>
        <Field label="Fällig">{formatDate(invoice.dueDate)}</Field>
        <Field label="Bezahlt am">
          {invoice.paidDate ? formatDate(invoice.paidDate) : "—"}
        </Field>
        <Field label="davon Steuer">
          {formatCurrency(invoice.totalTaxValue)}
        </Field>
        <Field label="Zahlungsziel">{paymentTermLabel(invoice.paymentTerm)}</Field>
        <Field label="Leistungszeitraum">{leistungszeitraum}</Field>
        {invoice.orderNumber ? (
          <Field label="Auftragsnummer">{invoice.orderNumber}</Field>
        ) : null}
      </FieldGrid>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Positionen</h2>
        <PositionsTable
          rows={lines}
          sum={lines.length ? netSum : null}
          sumLabel="Summe Positionen (netto)"
        />
      </div>
    </div>
  );
}
