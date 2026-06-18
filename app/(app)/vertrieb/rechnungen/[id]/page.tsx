import { notFound } from "next/navigation";

import { getSession } from "@/lib/auth";
import { canAccessSales } from "@/lib/auth/sales-access";
import { invoices } from "@/lib/autotask/entities/invoices";
import { billingItems, type InvoiceLineRow } from "@/lib/autotask/entities/billing-items";
import { companies } from "@/lib/autotask/entities/companies";
import { currentMs } from "@/lib/format";
import { loadOrError } from "@/lib/data/load-or-error";
import { DataError } from "@/components/data-error";
import { PageHeader } from "@/components/page-header";
import { VertriebBreadcrumb } from "@/components/vertrieb/vertrieb-breadcrumb";
import { InvoiceDetail } from "@/components/vertrieb/invoice-detail";

export const dynamic = "force-dynamic";

export default async function RechnungDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoiceId = Number(id);
  if (!Number.isFinite(invoiceId)) notFound();

  const session = await getSession();
  if (!session) return null;
  if (!canAccessSales(session)) notFound(); // Gate vor jedem Datenabruf (Streaming-Leak).

  const res = await loadOrError(() => invoices.get(invoiceId));
  if (!res.ok)
    return (
      <DataError
        title="Rechnung konnte nicht geladen werden"
        rateLimited={res.rateLimited}
      />
    );
  const invoice = res.data;
  if (!invoice) notFound();

  // Firmenname + Positionen best effort – Teilfehler dürfen das Detail nicht kippen.
  let companyName: string | null = null;
  if (invoice.companyID != null) {
    try {
      companyName = (await companies.get(invoice.companyID))?.companyName ?? null;
    } catch {
      companyName = null;
    }
  }
  let lines: InvoiceLineRow[] = [];
  try {
    lines = await billingItems.byInvoice(invoiceId);
  } catch {
    lines = [];
  }

  const nowMs = currentMs();
  const num = invoice.invoiceNumber ?? String(invoiceId);
  return (
    <div className="flex flex-col gap-6">
      <VertriebBreadcrumb
        listHref="/vertrieb/rechnungen"
        listLabel="Rechnungen"
        current={num}
      />
      <PageHeader title={`Rechnung ${num}`} />
      <InvoiceDetail
        invoice={invoice}
        companyName={companyName}
        lines={lines}
        nowMs={nowMs}
      />
    </div>
  );
}
