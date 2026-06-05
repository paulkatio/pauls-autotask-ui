import "server-only";

import { autotask } from "@/lib/autotask/client";
import type { ConfigurationItem } from "@/lib/autotask/types";

export interface RefOption {
  id: number;
  label: string;
}

// Zeile für die Geräte-Tabelle (Kundenakte B3): Name/Seriennummer/Standort.
export interface DeviceRow {
  id: number;
  name: string;
  serialNumber: string;
  location: string;
}

export const configurationItems = {
  get: (id: number): Promise<ConfigurationItem | null> =>
    autotask.get<ConfigurationItem>("ConfigurationItems", id),

  // Geräte/CIs EINER Firma als Tabellenzeilen.
  async rowsByCompany(companyId: number): Promise<DeviceRow[]> {
    const rows = await autotask.query<ConfigurationItem>("ConfigurationItems", {
      MaxRecords: 500,
      IncludeFields: [
        "id",
        "referenceTitle",
        "referenceNumber",
        "serialNumber",
        "location",
      ],
      Filter: [{ op: "eq", field: "companyID", value: companyId }],
    });
    return rows
      .map((ci) => ({
        id: ci.id,
        name: ci.referenceTitle || ci.referenceNumber || `#${ci.id}`,
        serialNumber: ci.serialNumber ?? "",
        location: ci.location ?? "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  },

  // Geräte/CIs EINER Firma (für die gefilterte Geräte-Auswahl).
  async byCompany(companyId: number): Promise<RefOption[]> {
    const rows = await autotask.query<ConfigurationItem>(
      "ConfigurationItems",
      {
        MaxRecords: 500,
        IncludeFields: ["id", "referenceTitle", "referenceNumber"],
        Filter: [{ op: "eq", field: "companyID", value: companyId }],
      },
      { autoPage: false },
    );
    return rows
      .map((ci) => ({
        id: ci.id,
        label:
          [ci.referenceTitle, ci.referenceNumber].filter(Boolean).join(" · ") ||
          `#${ci.id}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "de"));
  },
};
