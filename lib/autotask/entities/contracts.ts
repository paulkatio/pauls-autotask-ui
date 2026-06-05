import "server-only";

import { autotask } from "@/lib/autotask/client";

export interface RefOption {
  id: number;
  label: string;
}

interface Contract {
  id: number;
  contractName?: string;
  startDate?: string | null;
  endDate?: string | null;
  // status (verifiziert 2026-06-04): 0 = Inaktiv, 1 = Aktiv.
  status?: number | null;
}

// Zeile für die Verträge-Tabelle (Kundenakte B3): Name/Zeitraum/Status.
export interface ContractRow {
  id: number;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: number | null;
}

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
};
