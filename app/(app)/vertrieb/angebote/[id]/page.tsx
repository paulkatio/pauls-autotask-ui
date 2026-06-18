import { notFound } from "next/navigation";

import { getSession } from "@/lib/auth";
import { canAccessSales } from "@/lib/auth/sales-access";
import { quotes } from "@/lib/autotask/entities/quotes";
import { quoteItems } from "@/lib/autotask/entities/quote-items";
import { companies } from "@/lib/autotask/entities/companies";
import { loadOrError } from "@/lib/data/load-or-error";
import { DataError } from "@/components/data-error";
import { PageHeader } from "@/components/page-header";
import { VertriebBreadcrumb } from "@/components/vertrieb/vertrieb-breadcrumb";
import { QuoteDetail } from "@/components/vertrieb/quote-detail";

export const dynamic = "force-dynamic";

export default async function AngebotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quoteId = Number(id);
  if (!Number.isFinite(quoteId)) notFound();

  const session = await getSession();
  if (!session) return null;
  if (!canAccessSales(session)) notFound(); // Gate vor jedem Datenabruf (Streaming-Leak).

  const res = await loadOrError(() => quotes.get(quoteId));
  if (!res.ok)
    return (
      <DataError
        title="Angebot konnte nicht geladen werden"
        rateLimited={res.rateLimited}
      />
    );
  const quote = res.data;
  if (!quote) notFound();

  let companyName: string | null = null;
  if (quote.companyID != null) {
    try {
      companyName = (await companies.get(quote.companyID))?.companyName ?? null;
    } catch {
      companyName = null;
    }
  }
  let lines: Awaited<ReturnType<typeof quoteItems.byQuote>> = { rows: [], total: 0 };
  try {
    lines = await quoteItems.byQuote(quoteId);
  } catch {
    lines = { rows: [], total: 0 };
  }

  const num = quote.quoteNumber != null ? String(quote.quoteNumber) : String(quoteId);
  return (
    <div className="flex flex-col gap-6">
      <VertriebBreadcrumb
        listHref="/vertrieb/angebote"
        listLabel="Angebote"
        current={num}
      />
      <PageHeader title={`Angebot ${num}`} description={quote.name || undefined} />
      <QuoteDetail
        quote={quote}
        companyName={companyName}
        lines={lines.rows}
        total={lines.total}
      />
    </div>
  );
}
