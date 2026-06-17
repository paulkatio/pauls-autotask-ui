import "server-only";

import { unstable_cache } from "next/cache";

import { autotask } from "@/lib/autotask/client";
import type { AutotaskFilter } from "@/lib/autotask/client";
import { companies } from "@/lib/autotask/entities/companies";
import { resources } from "@/lib/autotask/entities/resources";

// Autotask `Quotes` – Felder verifiziert 2026-06-17 (Sandbox). KEIN gespeicherter
// Gesamtbetrag -> Betrag nur im Detail aus QuoteItems summieren (nicht in der Liste).
interface Quote {
  id: number;
  quoteNumber?: number | null;
  name?: string | null;
  description?: string | null;
  companyID?: number | null;
  contactID?: number | null;
  opportunityID?: number | null;
  creatorResourceID?: number | null;
  createDate?: string | null;
  effectiveDate?: string | null;
  expirationDate?: string | null;
  approvalStatus?: number | null;
  isActive?: boolean | null;
  paymentTerm?: number | null;
}

export interface QuoteRow {
  id: number;
  number: string;
  name: string;
  companyId: number | null;
  companyName: string;
  creatorName: string;
  date: string | null; // createDate (ISO)
  effectiveDate: string | null;
  expirationDate: string | null;
  approvalStatus: number | null;
  isActive: boolean;
}

// 579 Angebote gesamt -> Zeitfenster wie bei Rechnungen (27 Sätze seit Vorjahr).
const QUOTES_CAP = 1500;

export function defaultWindowStartISO(nowMs: number): string {
  const year = new Date(nowMs).getUTCFullYear();
  return `${year - 1}-01-01T00:00:00`;
}

function windowFilter(sinceISO: string | null): AutotaskFilter[] {
  return sinceISO
    ? [{ op: "gte", field: "createDate", value: sinceISO }]
    : [{ op: "gte", field: "id", value: 0 }];
}

const listCached = unstable_cache(
  async (
    sinceISO: string | null,
  ): Promise<{ rows: QuoteRow[]; total: number; capped: boolean }> => {
    const filter = windowFilter(sinceISO);
    const total = await autotask.count("Quotes", filter);
    const raw = await autotask.query<Quote>(
      "Quotes",
      {
        MaxRecords: 500,
        IncludeFields: [
          "id",
          "quoteNumber",
          "name",
          "companyID",
          "creatorResourceID",
          "createDate",
          "effectiveDate",
          "expirationDate",
          "approvalStatus",
          "isActive",
        ],
        Filter: filter,
      },
      { maxItems: QUOTES_CAP },
    );

    const [names, creators] = await Promise.all([
      companies.namesByIds(
        raw.map((r) => r.companyID).filter((n): n is number => n != null),
      ),
      resources.namesByIds(
        raw.map((r) => r.creatorResourceID).filter((n): n is number => n != null),
      ),
    ]);

    const rows: QuoteRow[] = raw
      .map((r) => ({
        id: r.id,
        number: r.quoteNumber != null ? String(r.quoteNumber) : `#${r.id}`,
        name: r.name ?? `#${r.id}`,
        companyId: r.companyID ?? null,
        companyName: r.companyID != null ? (names.get(r.companyID) ?? "") : "",
        creatorName:
          r.creatorResourceID != null
            ? (creators.get(r.creatorResourceID) ?? "")
            : "",
        date: r.createDate ?? null,
        effectiveDate: r.effectiveDate ?? null,
        expirationDate: r.expirationDate ?? null,
        approvalStatus: r.approvalStatus ?? null,
        isActive: Boolean(r.isActive),
      }))
      // Neueste zuerst (Erstelldatum absteigend); leere Daten ans Ende.
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

    return { rows, total, capped: total > rows.length };
  },
  ["quotes-list"],
  { revalidate: 60 },
);

export const quotes = {
  list: (sinceISO: string | null) => listCached(sinceISO),
  get: (id: number): Promise<Quote | null> => autotask.get<Quote>("Quotes", id),
};

export type { Quote };
