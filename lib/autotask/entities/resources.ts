import "server-only";

import { unstable_cache } from "next/cache";

import { autotask } from "@/lib/autotask/client";
import type { Resource } from "@/lib/autotask/types";

function fullName(r: Resource): string {
  return `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim();
}

export interface ResourceOption {
  id: number;
  name: string;
}

export const resources = {
  get: (id: number): Promise<Resource | null> =>
    autotask.get<Resource>("Resources", id),

  // Aktive Resource per E-Mail (Entra-Login-Mapping, B16). Erster Treffer oder null
  // (KEIN Fabrizieren). Hinweis: in der Sandbox teilen sich mehrere Resources die
  // Sammel-Mail – fürs Mapping zählt die individuelle, eindeutige Mail.
  async byEmail(
    email: string,
  ): Promise<{ id: number; name: string } | null> {
    const e = email.trim();
    if (!e) return null;
    const rows = await autotask.query<Resource>(
      "Resources",
      {
        MaxRecords: 5,
        IncludeFields: ["id", "firstName", "lastName", "email", "isActive"],
        Filter: [
          { op: "eq", field: "email", value: e },
          { op: "eq", field: "isActive", value: true },
        ],
      },
      { autoPage: false },
    );
    const r = rows[0];
    return r ? { id: r.id, name: fullName(r) || `#${r.id}` } : null;
  },

  // Aktive interne Mitarbeiter (licenseType 1) für die Zuweisungs-Auswahl.
  // Das System-Konto „Autotask Administrator" wird NICHT zur Auswahl angeboten
  // (Paul: kein zuweisbarer Mitarbeiter).
  async listActive(): Promise<ResourceOption[]> {
    const rows = await autotask.query<Resource>(
      "Resources",
      {
        MaxRecords: 500,
        IncludeFields: ["id", "firstName", "lastName"],
        Filter: [
          { op: "eq", field: "isActive", value: true },
          { op: "eq", field: "licenseType", value: 1 },
        ],
      },
      { autoPage: false },
    );
    return rows
      .map((r) => ({ id: r.id, name: fullName(r) || `#${r.id}` }))
      .filter((o) => o.name !== "Autotask Administrator")
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  },

  // Mehrere Resource-Namen in EINEM Request (in-Operator), kein N+1.
  // (Helper unverändert; gecachte Variante siehe getAssignableResources.)
  async namesByIds(ids: number[]): Promise<Map<number, string>> {
    const unique = [...new Set(ids.filter((n) => Number.isFinite(n)))];
    const map = new Map<number, string>();
    if (unique.length === 0) return map;
    const rows = await autotask.query<Resource>("Resources", {
      MaxRecords: 500,
      IncludeFields: ["id", "firstName", "lastName"],
      Filter: [{ op: "in", field: "id", value: unique }],
    });
    for (const r of rows) {
      const name = fullName(r);
      if (name) map.set(r.id, name);
    }
    return map;
  },
};

// Zuweisbare Resources für die Bulk-Leiste. Ändern sich selten -> 5 min gecacht,
// damit die Ticketlisten nicht bei jedem Aufruf erneut Resources abfragen.
export const getAssignableResources = unstable_cache(
  async (): Promise<ResourceOption[]> => resources.listActive(),
  ["assignable-resources"],
  { revalidate: 300 },
);
