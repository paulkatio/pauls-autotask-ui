import "server-only";

import { unstable_cache } from "next/cache";

import { autotask } from "@/lib/autotask/client";
import type { Company } from "@/lib/autotask/types";

// Dünner Wrapper für Companies. namesByIds löst mehrere companyIDs in EINEM
// gebündelten Request auf (in-Operator, in DECISIONS bestätigt) – kein N+1.
export interface CompanyOption {
  id: number;
  name: string;
}

// Firmen-Suchtreffer für die /search-Ergebnisseite (C2).
export interface CompanySearchRow {
  id: number;
  name: string;
  city: string;
}

// Listeneintrag für die Firmenseite (B2 + Kundenart-Filter aus Paul-Feedback).
export interface CompanyListItem {
  id: number;
  name: string;
  city: string;
  phone: string;
  companyType: number | null;
}

// Aktive Firmen gebündelt (paged), 60 s gecacht. Cap 1000 (Stand 2026-06-04:
// 637 aktive Firmen -> deckt alle ab, bleibt aber begrenzt). Server sortiert
// nicht (DECISIONS B13) -> Sortierung passiert clientseitig in der Tabelle.
const COMPANIES_CAP = 1000;
const listActiveCached = unstable_cache(
  async (): Promise<{ items: CompanyListItem[]; capped: boolean }> => {
    const rows = await autotask.query<Company>(
      "Companies",
      {
        MaxRecords: 500,
        IncludeFields: ["id", "companyName", "city", "phone", "companyType"],
        Filter: [{ op: "eq", field: "isActive", value: true }],
      },
      { maxItems: COMPANIES_CAP },
    );
    const items = rows.map((c) => ({
      id: c.id,
      name: c.companyName ?? `#${c.id}`,
      city: c.city ?? "",
      phone: c.phone ?? "",
      companyType: c.companyType ?? null,
    }));
    return { items, capped: rows.length >= COMPANIES_CAP };
  },
  ["companies-list-active"],
  { revalidate: 60 },
);

// Eigene Firma = companyID 0 (Autotask-Konvention: der Tenant selbst). Dient dem
// App-Branding (Sidebar/Login/Manifest/Mail-Signatur). SEHR lang gecacht (24 h) –
// der eigene Firmenname ändert sich praktisch nie, kostet so kaum Threads/Rate.
const ownCompanyNameCached = unstable_cache(
  async (): Promise<string | null> => {
    const rows = await autotask.query<Company>(
      "Companies",
      {
        MaxRecords: 1,
        IncludeFields: ["id", "companyName"],
        Filter: [{ op: "eq", field: "id", value: 0 }],
      },
      { autoPage: false },
    );
    return rows[0]?.companyName?.trim() || null;
  },
  ["own-company-name"],
  { revalidate: 86400 },
);

export const companies = {
  // Einzelne Firma inkl. Anschrift/Telefon (lesend, fürs Kontextpanel).
  get: (id: number): Promise<Company | null> =>
    autotask.get<Company>("Companies", id),

  // Name der eigenen Firma (companyID 0), gecacht. null bei Fehler/leer.
  ownName: (): Promise<string | null> => ownCompanyNameCached(),

  // Aktive Firmen für die Firmenliste (gecacht, s. listActiveCached).
  listActive: () => listActiveCached(),

  // Firmensuche (für den Firmenwechsel). companyName contains, nur aktive, Top 25.
  async search(query: string): Promise<CompanyOption[]> {
    const q = query.trim();
    if (!q) return [];
    const rows = await autotask.query<Company>(
      "Companies",
      {
        MaxRecords: 25,
        IncludeFields: ["id", "companyName"],
        Filter: [
          { op: "contains", field: "companyName", value: q },
          { op: "eq", field: "isActive", value: true },
        ],
      },
      { autoPage: false },
    );
    return rows
      .map((c) => ({ id: c.id, name: c.companyName ?? `#${c.id}` }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  },

  // Firmensuche mit Ort für die /search-Ergebnisseite (companyName contains, aktiv).
  async searchRows(query: string, limit = 50): Promise<CompanySearchRow[]> {
    const q = query.trim();
    if (!q) return [];
    const rows = await autotask.query<Company>(
      "Companies",
      {
        MaxRecords: limit,
        IncludeFields: ["id", "companyName", "city"],
        Filter: [
          { op: "contains", field: "companyName", value: q },
          { op: "eq", field: "isActive", value: true },
        ],
      },
      { autoPage: false },
    );
    return rows
      .map((c) => ({
        id: c.id,
        name: c.companyName ?? `#${c.id}`,
        city: c.city ?? "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  },

  async namesByIds(ids: number[]): Promise<Map<number, string>> {
    const unique = [...new Set(ids.filter((n) => Number.isFinite(n)))];
    const map = new Map<number, string>();
    if (unique.length === 0) return map;

    const CHUNK = 200;
    for (let i = 0; i < unique.length; i += CHUNK) {
      const slice = unique.slice(i, i + CHUNK);
      const rows = await autotask.query<Company>("Companies", {
        MaxRecords: 500,
        IncludeFields: ["id", "companyName"],
        Filter: [{ op: "in", field: "id", value: slice }],
      });
      for (const c of rows) {
        if (c.companyName) map.set(c.id, c.companyName);
      }
    }
    return map;
  },
};
