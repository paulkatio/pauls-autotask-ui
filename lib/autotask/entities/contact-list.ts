import "server-only";

import {
  contacts,
  type ContactRow,
} from "@/lib/autotask/entities/contacts";
import { companies } from "@/lib/autotask/entities/companies";

// Kontaktliste (B4): Kontakte (erste Seite oder contains-Suche) inkl. gebündelt
// aufgelöstem Firmennamen (in-Operator, kein N+1).
export interface ContactListRow extends ContactRow {
  companyName: string | null;
}

export async function getContactsList(
  query?: string,
  companyId?: number,
): Promise<ContactListRow[]> {
  const rows = await contacts.searchRows(query, companyId);
  const ids = rows
    .map((r) => r.companyID)
    .filter((n): n is number => typeof n === "number");
  const names = await companies.namesByIds(ids);
  return rows.map((r) => ({
    ...r,
    companyName:
      r.companyID != null ? (names.get(r.companyID) ?? null) : null,
  }));
}
