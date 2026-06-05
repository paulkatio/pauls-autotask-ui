import "server-only";

import { autotask, type AutotaskFilter } from "@/lib/autotask/client";
import type { Contact } from "@/lib/autotask/types";

function fullName(c: Contact): string {
  return `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
}

export interface RefOption {
  id: number;
  label: string;
}

// Zeile für die Kontakte-Tabelle (Kundenakte B3 / Kontaktliste B4).
export interface ContactRow {
  id: number;
  name: string;
  email: string;
  phone: string;
  companyID: number | null;
}

export const contacts = {
  get: (id: number): Promise<Contact | null> =>
    autotask.get<Contact>("Contacts", id),

  // Aktive Kontakte EINER Firma als Tabellenzeilen (Name/E-Mail/Telefon).
  async rowsByCompany(companyId: number): Promise<ContactRow[]> {
    const rows = await autotask.query<Contact>("Contacts", {
      MaxRecords: 500,
      IncludeFields: [
        "id",
        "firstName",
        "lastName",
        "emailAddress",
        "phone",
        "mobilePhone",
        "companyID",
        "isActive",
      ],
      Filter: [
        { op: "eq", field: "companyID", value: companyId },
        { op: "eq", field: "isActive", value: true },
      ],
    });
    return rows
      .map((c) => ({
        id: c.id,
        name: fullName(c) || `#${c.id}`,
        email: c.emailAddress ?? "",
        phone: c.phone || c.mobilePhone || "",
        companyID: c.companyID ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  },

  // Kontaktliste (B4 + Firma-Filter, Paul-Feedback): erste Seite ODER serverseitige
  // contains-Suche auf Vor-/Nachname (OR-Gruppe), optional auf EINE Firma eingegrenzt.
  // Server sortiert nicht -> Sortierung clientseitig. Ohne query+companyId = erste
  // Seite aktiver Kontakte.
  async searchRows(
    query?: string,
    companyId?: number,
    limit = 200,
  ): Promise<ContactRow[]> {
    const q = (query ?? "").trim();
    const filter: AutotaskFilter[] = [
      { op: "eq", field: "isActive", value: true },
    ];
    if (companyId != null) {
      filter.push({ op: "eq", field: "companyID", value: companyId });
    }
    if (q) {
      filter.push({
        op: "or",
        items: [
          { op: "contains", field: "firstName", value: q },
          { op: "contains", field: "lastName", value: q },
        ],
      });
    }
    const rows = await autotask.query<Contact>(
      "Contacts",
      {
        MaxRecords: limit,
        IncludeFields: [
          "id",
          "firstName",
          "lastName",
          "emailAddress",
          "phone",
          "mobilePhone",
          "companyID",
          "isActive",
        ],
        Filter: filter,
      },
      { autoPage: false },
    );
    return rows
      .map((c) => ({
        id: c.id,
        name: fullName(c) || `#${c.id}`,
        email: c.emailAddress ?? "",
        phone: c.phone || c.mobilePhone || "",
        companyID: c.companyID ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  },

  // Aktive Kontakte EINER Firma (für die gefilterte Kontakt-Auswahl).
  async byCompany(companyId: number): Promise<RefOption[]> {
    const rows = await autotask.query<Contact>(
      "Contacts",
      {
        MaxRecords: 500,
        IncludeFields: ["id", "firstName", "lastName", "isActive"],
        Filter: [
          { op: "eq", field: "companyID", value: companyId },
          { op: "eq", field: "isActive", value: true },
        ],
      },
      { autoPage: false },
    );
    return rows
      .map((c) => ({ id: c.id, label: fullName(c) || `#${c.id}` }))
      .sort((a, b) => a.label.localeCompare(b.label, "de"));
  },

  // Mehrere Kontakt-Namen in EINEM Request (in-Operator), kein N+1.
  async namesByIds(ids: number[]): Promise<Map<number, string>> {
    const unique = [...new Set(ids.filter((n) => Number.isFinite(n)))];
    const map = new Map<number, string>();
    if (unique.length === 0) return map;
    const rows = await autotask.query<Contact>("Contacts", {
      MaxRecords: 500,
      IncludeFields: ["id", "firstName", "lastName"],
      Filter: [{ op: "in", field: "id", value: unique }],
    });
    for (const c of rows) {
      const name = fullName(c);
      if (name) map.set(c.id, name);
    }
    return map;
  },
};
