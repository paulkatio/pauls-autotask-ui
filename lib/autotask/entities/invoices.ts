import "server-only";

import { unstable_cache } from "next/cache";

import { autotask } from "@/lib/autotask/client";
import type { AutotaskFilter } from "@/lib/autotask/client";
import { companies } from "@/lib/autotask/entities/companies";

// Autotask `Invoices` – Felder verifiziert 2026-06-17 (Sandbox), alle read-only.
// KEIN Währungsfeld an der Rechnung (Tenant DE) -> Anzeige EUR.
interface Invoice {
  id: number;
  invoiceNumber?: string | null;
  companyID?: number | null;
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
  date: string | null; // invoiceDateTime (ISO)
  dueDate: string | null;
  paidDate: string | null;
  isVoided: boolean;
  total: number | null;
}

// 2679 Rechnungen gesamt -> nie alle ungefiltert (Server sortiert NICHT, DECISIONS
// B13). Default-Zeitfenster „seit 1. Jan. Vorjahr" (137 Sätze << Cap). Sicherheits-Cap.
const INVOICES_CAP = 1500;

// Fensterstart: 1. Januar des Vorjahres (relativ zu nowMs). nowMs wird übergeben,
// damit der unstable_cache-Key vom Aufrufer (Seite) bestimmt wird, nicht von Date.now.
export function defaultWindowStartISO(nowMs: number): string {
  const year = new Date(nowMs).getUTCFullYear();
  return `${year - 1}-01-01T00:00:00`;
}

function windowFilter(sinceISO: string | null): AutotaskFilter[] {
  return sinceISO
    ? [{ op: "gte", field: "invoiceDateTime", value: sinceISO }]
    : [{ op: "gte", field: "id", value: 0 }];
}

const listCached = unstable_cache(
  async (
    sinceISO: string | null,
  ): Promise<{ rows: InvoiceRow[]; total: number; capped: boolean }> => {
    const filter = windowFilter(sinceISO);
    const total = await autotask.count("Invoices", filter);
    const raw = await autotask.query<Invoice>(
      "Invoices",
      {
        MaxRecords: 500,
        IncludeFields: [
          "id",
          "invoiceNumber",
          "companyID",
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

    const names = await companies.namesByIds(
      raw.map((r) => r.companyID).filter((n): n is number => n != null),
    );

    const rows: InvoiceRow[] = raw
      .map((r) => ({
        id: r.id,
        number: r.invoiceNumber ?? `#${r.id}`,
        companyId: r.companyID ?? null,
        companyName: r.companyID != null ? (names.get(r.companyID) ?? "") : "",
        date: r.invoiceDateTime ?? null,
        dueDate: r.dueDate ?? null,
        paidDate: r.paidDate ?? null,
        isVoided: Boolean(r.isVoided),
        total: r.invoiceTotal ?? null,
      }))
      // Neueste zuerst (Rechnungsdatum absteigend); leere Daten ans Ende.
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

    return { rows, total, capped: total > rows.length };
  },
  ["invoices-list"],
  { revalidate: 60 },
);

export const invoices = {
  // Rechnungsliste im Zeitfenster (sinceISO = null -> alle, gecappt).
  list: (sinceISO: string | null) => listCached(sinceISO),

  // Einzelne Rechnung fürs Detail.
  get: (id: number): Promise<Invoice | null> =>
    autotask.get<Invoice>("Invoices", id),
};

export type { Invoice };
