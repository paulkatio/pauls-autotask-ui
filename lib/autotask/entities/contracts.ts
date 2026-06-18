import "server-only";

import { unstable_cache } from "next/cache";

import { autotask } from "@/lib/autotask/client";
import { companies } from "@/lib/autotask/entities/companies";
import {
  type YearWindow,
  yearWindowFilter,
} from "@/lib/vertrieb/year-window";

export interface RefOption {
  id: number;
  label: string;
}

// Felder verifiziert 2026-06-17 (Sandbox). status: 0 = Inaktiv, 1 = Aktiv.
interface Contract {
  id: number;
  contractName?: string;
  contractNumber?: string | null;
  companyID?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: number | null;
  contractCategory?: number | null;
  contractType?: number | null;
  description?: string | null;
}

// Zeile für die Verträge-Tabelle (Kundenakte B3): Name/Zeitraum/Status.
export interface ContractRow {
  id: number;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: number | null;
}

// Zeile für die Vertriebs-Vertragsliste (firmenübergreifend, inkl. Firmenname).
export interface ContractListRow {
  id: number;
  name: string;
  number: string;
  companyId: number | null;
  companyName: string;
  startDate: string | null;
  endDate: string | null;
  status: number | null;
  category: number | null;
  type: number | null;
}

// Verträge gesamt 444 Sätze (< Cap). Jahresfenster (gte+lt auf startDate =
// Vertragsbeginn); "alle" (win=null) = ungefiltert, gecappt.
const CONTRACTS_CAP = 1500;

const listWindowCached = unstable_cache(
  async (
    win: YearWindow | null,
  ): Promise<{ rows: ContractListRow[]; capped: boolean }> => {
    const raw = await autotask.query<Contract>(
      "Contracts",
      {
        MaxRecords: 500,
        IncludeFields: [
          "id",
          "contractName",
          "contractNumber",
          "companyID",
          "startDate",
          "endDate",
          "status",
          "contractCategory",
          "contractType",
        ],
        Filter: yearWindowFilter(win, "startDate"),
      },
      { maxItems: CONTRACTS_CAP },
    );

    const names = await companies.namesByIds(
      raw.map((c) => c.companyID).filter((n): n is number => n != null),
    );

    const rows = raw
      .map((c) => ({
        id: c.id,
        name: c.contractName ?? `#${c.id}`,
        number: c.contractNumber ?? "",
        companyId: c.companyID ?? null,
        companyName: c.companyID != null ? (names.get(c.companyID) ?? "") : "",
        startDate: c.startDate ?? null,
        endDate: c.endDate ?? null,
        status: c.status ?? null,
        category: c.contractCategory ?? null,
        type: c.contractType ?? null,
      }))
      // Neueste zuerst (Vertragsbeginn absteigend); leere Daten ans Ende.
      .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));

    return { rows, capped: raw.length >= CONTRACTS_CAP };
  },
  ["contracts-list-window"],
  { revalidate: 60 },
);

export const contracts = {
  // Verträge EINER Firma als Tabellenzeilen (Name/Zeitraum/Status).
  async rowsByCompany(companyId: number): Promise<ContractRow[]> {
    const rows = await autotask.query<Contract>("Contracts", {
      MaxRecords: 500,
      IncludeFields: ["id", "contractName", "startDate", "endDate", "status"],
      Filter: [{ op: "eq", field: "companyID", value: companyId }],
    });
    return rows
      .map((c) => ({
        id: c.id,
        name: c.contractName ?? `#${c.id}`,
        startDate: c.startDate ?? null,
        endDate: c.endDate ?? null,
        status: c.status ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  },

  // Verträge EINER Firma (für die gefilterte Vertrags-Auswahl).
  async byCompany(companyId: number): Promise<RefOption[]> {
    const rows = await autotask.query<Contract>(
      "Contracts",
      {
        MaxRecords: 500,
        IncludeFields: ["id", "contractName"],
        Filter: [{ op: "eq", field: "companyID", value: companyId }],
      },
      { autoPage: false },
    );
    return rows
      .map((c) => ({ id: c.id, label: c.contractName ?? `#${c.id}` }))
      .sort((a, b) => a.label.localeCompare(b.label, "de"));
  },

  async nameById(id: number): Promise<string | null> {
    const c = await autotask.get<Contract>("Contracts", id);
    return c?.contractName ?? null;
  },

  // Verträge firmenübergreifend (Vertriebsbereich) im Jahresfenster, gecacht.
  list: (win: YearWindow | null) => listWindowCached(win),

  // Einzelner Vertrag fürs Detail (Kopf-Felder).
  get: (id: number): Promise<Contract | null> =>
    autotask.get<Contract>("Contracts", id),
};

export type { Contract };
