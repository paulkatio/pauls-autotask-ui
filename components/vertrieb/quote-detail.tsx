import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import {
  paymentTermLabel,
  quoteStatusLabel,
  quoteStatusVariant,
} from "@/lib/autotask/mappers";
import type { Quote } from "@/lib/autotask/entities/quotes";
import type { QuoteLineRow } from "@/lib/autotask/entities/quote-items";
import { Field, FieldGrid, PositionsTable } from "@/components/vertrieb/detail-rail";

export function QuoteDetail({
  quote,
  companyName,
  lines,
  total,
}: {
  quote: Quote;
  companyName: string | null;
  lines: QuoteLineRow[];
  total: number;
}) {
  return (
    <div className="flex flex-col gap-6">
      <FieldGrid>
        <Field label="Firma">
          {quote.companyID != null ? (
            <Link href={`/companies/${quote.companyID}`} className="hover:underline">
              {companyName ?? `Firma ${quote.companyID}`}
            </Link>
          ) : (
            "—"
          )}
        </Field>
        <Field label="Erstellt">{formatDate(quote.createDate)}</Field>
        <Field label="Status">
          <Badge variant={quoteStatusVariant(quote.approvalStatus)}>
            {quoteStatusLabel(quote.approvalStatus)}
          </Badge>
        </Field>
        <Field label="Gültig ab">{formatDate(quote.effectiveDate)}</Field>
        <Field label="Gültig bis">{formatDate(quote.expirationDate)}</Field>
        <Field label="Zahlungsziel">{paymentTermLabel(quote.paymentTerm)}</Field>
        <Field label="Aktiv">{quote.isActive ? "Ja" : "Nein"}</Field>
        {quote.description ? (
          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="Beschreibung">{quote.description}</Field>
          </div>
        ) : null}
      </FieldGrid>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Positionen</h2>
        <PositionsTable
          rows={lines}
          sum={lines.length ? total : null}
          sumLabel="Gesamt (netto, ohne Rabatt/Steuer)"
        />
      </div>
    </div>
  );
}
