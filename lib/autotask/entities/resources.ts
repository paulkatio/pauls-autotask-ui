import "server-only";

import { unstable_cache } from "next/cache";

import { autotask } from "@/lib/autotask/client";
import type { Resource } from "@/lib/autotask/types";

function fullName(r: Resource): string {
  return `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim();
}

// Normalisiert eine E-Mail für den toleranten Sandbox-Abgleich: Kleinschreibung +
// „Plus-Tag" entfernen (local+tag@domain -> local@domain). Nötig, weil der Autotask-
// Sandbox-Refresh den Resource-Mails einen Suffix anhängt (z. B.
// `Paul.Katio+psasandbox@…`), während die echte Microsoft-Login-Mail keinen hat.
function normalizeEmail(email: string): string {
  const lower = email.trim().toLowerCase();
  const at = lower.indexOf("@");
  if (at < 0) return lower;
  const local = lower.slice(0, at).split("+")[0];
  return `${local}${lower.slice(at)}`;
}

export interface ResourceOption {
  id: number;
  name: string;
}

export const resources = {
  get: (id: number): Promise<Resource | null> =>
    autotask.get<Resource>("Resources", id),

  // Aktive Resource per E-Mail (Entra-Login-Mapping, B16). Erster Treffer oder null
  // (KEIN Fabrizieren).
  //
  // 1) Exakter Abgleich – der Produktionspfad. Echte Resource-Mails == Login-Mail.
  // 2) Optionaler Sandbox-Fallback (nur wenn ENTRA_EMAIL_LOOSE_MATCH=1): da der
  //    Sandbox-Refresh den Mails ein „+tag" anhängt (Paul.Katio+psasandbox@…),
  //    werden bei Misserfolg alle aktiven Resources normalisiert (Kleinschreibung +
  //    Plus-Tag entfernt) verglichen. Produktion lässt das Flag weg -> streng exakt.
  async byEmail(
    email: string,
  ): Promise<{ id: number; name: string } | null> {
    const e = email.trim();
    if (!e) return null;

    const exact = await autotask.query<Resource>(
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
    const hit = exact[0];
    if (hit) return { id: hit.id, name: fullName(hit) || `#${hit.id}` };

    if (process.env.ENTRA_EMAIL_LOOSE_MATCH !== "1") return null;

    const target = normalizeEmail(e);
    const active = await autotask.query<Resource>("Resources", {
      MaxRecords: 500,
      IncludeFields: ["id", "firstName", "lastName", "email", "isActive"],
      Filter: [{ op: "eq", field: "isActive", value: true }],
    });
    const loose = active.find(
      (r) => r.email && normalizeEmail(r.email) === target,
    );
    return loose ? { id: loose.id, name: fullName(loose) || `#${loose.id}` } : null;
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
