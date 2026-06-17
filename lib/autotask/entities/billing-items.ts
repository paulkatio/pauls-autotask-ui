import "server-only";

import { autotask } from "@/lib/autotask/client";

// Rechnungspositionen = Autotask `BillingItems` gefiltert nach invoiceID
// (verifiziert 2026-06-17, Sandbox). Alle Felder read-only.
interface BillingItem {
  id: number;
  invoiceID?: number | null;
  itemName?: string | null;
  description?: string | null;
  lineItemFullDescription?: string | null;
  quantity?: number | null;
  rate?: number | null; // Einzelpreis (netto)
  extendedPrice?: number | null;
  totalAmount?: number | null; // Zeilensumme (netto)
  itemDate?: string | null;
}

// Schlanke Positionszeile fürs Rechnungsdetail.
export interface InvoiceLineRow {
  id: number;
  name: string;
  description: string | null;
  quantity: number | null;
  unitPrice: number | null;
  total: number | null;
}

export const billingItems = {
  // Positionen EINER Rechnung (read-only). Nach itemName/Datum stabil sortiert.
  async byInvoice(invoiceId: number): Promise<InvoiceLineRow[]> {
    const raw = await autotask.query<BillingItem>("BillingItems", {
      MaxRecords: 500,
      IncludeFields: [
        "id",
        "invoiceID",
        "itemName",
        "description",
        "quantity",
        "rate",
        "extendedPrice",
        "totalAmount",
      ],
      Filter: [{ op: "eq", field: "invoiceID", value: invoiceId }],
    });

    return raw.map((b) => ({
      id: b.id,
      name: b.itemName ?? "—",
      description: b.description ?? null,
      quantity: b.quantity ?? null,
      unitPrice: b.rate ?? null,
      total: b.totalAmount ?? b.extendedPrice ?? null,
    }));
  },
};
