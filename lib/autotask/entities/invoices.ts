import "server-only";

import { unstable_cache } from "next/cache";

import { autotask } from "@/lib/autotask/client";
import { companies } from "@/lib/autotask/entities/companies";
import { resources } from "@/lib/autotask/entities/resources";
import {
  type YearWindow,
  yearWindowFilter,
} from "@/lib/vertrieb/year-window";

// Autotask `Invoices` – Felder verifiziert 2026-06-17 (Sandbox), alle read-only.
// KEIN Währungsfeld an der Rechnung (Tenant DE) -> Anzeige EUR.
interface Invoice {
  id: number;
  invoiceNumber?: string | null;
  companyID?: number | null;
  creatorResourceID?: number | null;
  invoiceDateTime?: string | null;
  dueDate?: string | null;
  paidDate?: string | null;
  invoiceTotal?: number | null;
  totalTaxValue?: number | null;
  isVoided?: boolean | null;
  paymentTerm?: number | null;
  orderNumber?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
}

// Schlanke Listenzeile. Der Zahlstatus wird NICHT hier gesetzt, sondern erst in der
// Client-Liste aus (isVoided/paidDate/dueDate) gegen „jetzt" abgeleitet (immer frisch,
// Cache bleibt rein). Siehe lib/autotask/mappers.deriveInvoiceStatus.
export interface InvoiceRow {
  id: number;
  number: string;
  companyId: number | null;
  companyName: string;
  creatorName: string;
  date: string | null; // invoiceDateTime (ISO)
  dueDate: string | null;
  paidDate: string | null;
  isVoided: boolean;
  total: number | null;
  // Zahlstil der Firma: true = SEPA (Firmen-UDF „Zahlungsart" enthält SEPA).
  isSepa: boolean;
}

// 2679 Rechnungen gesamt -> nie alle ungefiltert (Server sortiert NICHT, DECISIONS
// B13). Jahresfenster (gte+lt auf invoiceDateTime); "alle" (win=null) gecappt.
const INVOICES_CAP = 1500;

const listCached = unstable_cache(
  async (
    win: YearWindow | null,
  ): Promise<{ rows: InvoiceRow[]; total: number; capped: boolean }> => {
    const filter = yearWindowFilter(win, "invoiceDateTime");
    const total = await autotask.count("Invoices", filter);
    const raw = await autotask.query<Invoice>(
      "Invoices",
      {
        MaxRecords: 500,
        IncludeFields: [
          "id",
          "invoiceNumber",
          "companyID",
          "creatorResourceID",
          "invoiceDateTime",
          "dueDate",
          "paidDate",
          "invoiceTotal",
          "isVoided",
        ],
        Filter: filter,
      },
      { maxItems: INVOICES_CAP },
    );

    // Firmennamen, Ersteller-Namen und SEPA-Firmen-Set – je ein gebündelter Call.
    const [names, creators, sepaSet] = await Promise.all([
      companies.namesByIds(
        raw.map((r) => r.companyID).filter((n): n is number => n != null),
      ),
      resources.namesByIds(
        raw.map((r) => r.creatorResourceID).filter((n): n is number => n != null),
      ),
      companies.sepaCompanyIds(),
    ]);

    const rows: InvoiceRow[] = raw
      .map((r) => ({
        id: r.id,
        number: r.invoiceNumber ?? `#${r.id}`,
        companyId: r.companyID ?? null,
        companyName: r.companyID != null ? (names.get(r.companyID) ?? "") : "",
        creatorName:
          r.creatorResourceID != null
            ? (creators.get(r.creatorResourceID) ?? "")
            : "",
        date: r.invoiceDateTime ?? null,
        dueDate: r.dueDate ?? null,
        paidDate: r.paidDate ?? null,
        isVoided: Boolean(r.isVoided),
        total: r.invoiceTotal ?? null,
        isSepa: r.companyID != null && sepaSet.has(r.companyID),
      }))
      // Neueste zuerst (Rechnungsdatum absteigend); leere Daten ans Ende.
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

    return { rows, total, capped: total > rows.length };
  },
  ["invoices-list"],
  { revalidate: 60 },
);

export const invoices = {
  // Rechnungsliste im Jahresfenster (win = null -> alle, gecappt).
  list: (win: YearWindow | null) => listCached(win),

  // Einzelne Rechnung fürs Detail.
  get: (id: number): Promise<Invoice | null> =>
    autotask.get<Invoice>("Invoices", id),
};

export type { Invoice };
