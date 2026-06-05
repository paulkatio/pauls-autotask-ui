import "server-only";

import { autotask } from "@/lib/autotask/client";
import {
  companies,
  type CompanyListItem,
} from "@/lib/autotask/entities/companies";
import { tickets } from "@/lib/autotask/entities/tickets";

// Firmenliste (B2): aktive Firmen + Spalte „offene Tickets" aus EINEM gebündelten
// Open-Ticket-Abruf (clientseitig nach companyID gruppiert – KEIN Count pro Firma).
// Beide Quellen 60 s gecacht. Sortierung/Filter passieren clientseitig (B13).

export interface CompanyRow extends CompanyListItem {
  openTickets: number;
}

export interface CompaniesListResult {
  rows: CompanyRow[];
  companiesCapped: boolean;
  openCapped: boolean;
}

export async function getCompaniesList(): Promise<CompaniesListResult> {
  const [list, open] = await Promise.all([
    companies.listActive(),
    tickets.openCompanyCounts(),
  ]);
  const rows: CompanyRow[] = list.items.map((c) => ({
    ...c,
    openTickets: open.counts[c.id] ?? 0,
  }));
  return { rows, companiesCapped: list.capped, openCapped: open.capped };
}

// Kennzahlen für den Kundenakte-Kopf (Paul-Feedback: Überblick-Karte). Fünf
// günstige Count-Abfragen (Count-Endpoint), parallel.
export interface CompanyStats {
  openTickets: number;
  closedTickets: number;
  contacts: number;
  devices: number;
  contracts: number;
}

export async function getCompanyStats(companyId: number): Promise<CompanyStats> {
  const company = { op: "eq" as const, field: "companyID", value: companyId };
  const [openTickets, closedTickets, contacts, devices, contracts] =
    await Promise.all([
      autotask.count("Tickets", [
        company,
        { op: "noteq", field: "status", value: 5 },
      ]),
      autotask.count("Tickets", [
        company,
        { op: "eq", field: "status", value: 5 },
      ]),
      autotask.count("Contacts", [
        company,
        { op: "eq", field: "isActive", value: true },
      ]),
      autotask.count("ConfigurationItems", [company]),
      autotask.count("Contracts", [company]),
    ]);
  return { openTickets, closedTickets, contacts, devices, contracts };
}
