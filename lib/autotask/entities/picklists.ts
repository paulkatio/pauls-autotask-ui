import "server-only";

import { unstable_cache } from "next/cache";

import { autotask, type PicklistValue } from "@/lib/autotask/client";
import type {
  Picklist,
  SubPicklist,
  TicketPicklists,
} from "@/lib/autotask/types";

// Wandelt Autotask-Picklist-Werte in die UI-Form (nur aktive, numerische value).
function activeOnly(values: PicklistValue[] | null): Picklist {
  return (values ?? [])
    .filter((v) => v.isActive)
    .map((v) => ({ value: Number(v.value), label: v.label }));
}

// Wie activeOnly, behält aber parentValue (für abhängige Picklists wie subIssueType).
function activeWithParent(values: PicklistValue[] | null): SubPicklist {
  return (values ?? [])
    .filter((v) => v.isActive)
    .map((v) => ({
      value: Number(v.value),
      label: v.label,
      parentValue: v.parentValue != null ? Number(v.parentValue) : null,
    }));
}

// Wie oben, aber OHNE Aktiv-Filter: Kategorie/Unterkategorie alter Tickets nutzen
// teils inaktive Werte (z. B. „Netzwerk" #11). Damit das Label trotzdem angezeigt
// werden kann, behalten wir hier alle Werte.
function allOf(values: PicklistValue[] | null): Picklist {
  return (values ?? []).map((v) => ({ value: Number(v.value), label: v.label }));
}
function allWithParent(values: PicklistValue[] | null): SubPicklist {
  return (values ?? []).map((v) => ({
    value: Number(v.value),
    label: v.label,
    parentValue: v.parentValue != null ? Number(v.parentValue) : null,
  }));
}

// Lädt status/priority/queue aus Tickets/entityInformation/fields.
// LANG gecacht (6 h): Feld-/Picklist-DEFINITIONEN ändern sich praktisch nie (nur wenn
// ein Autotask-Admin Felder/Queues umkonfiguriert). Das frühere `revalidate: 60` hat
// `getFieldInfo("Tickets")` ~jede Minute neu gefeuert und unnötig Threads gegen das
// 3-Threads-pro-Tabelle-Limit verbraucht (API-Threshold-Alert „getFieldInfo / Ticket").
export const getTicketPicklists = unstable_cache(
  async (): Promise<TicketPicklists> => {
    const fields = await autotask.fieldInfo("Tickets");
    const picklistOf = (name: string) =>
      fields.find((f) => f.name === name)?.picklistValues ?? null;
    return {
      status: activeOnly(picklistOf("status")),
      priority: activeOnly(picklistOf("priority")),
      queue: activeOnly(picklistOf("queueID")),
      sla: activeOnly(picklistOf("serviceLevelAgreementID")),
      source: activeOnly(picklistOf("source")),
      ticketType: activeOnly(picklistOf("ticketType")),
      // Kategorie/Unterkategorie: alle Werte (auch inaktive) -> Label immer auflösbar.
      issueType: allOf(picklistOf("issueType")),
      subIssueType: allWithParent(picklistOf("subIssueType")),
    };
  },
  ["ticket-picklists"],
  { revalidate: 21600 }, // 6 h
);

export interface NotePicklists {
  noteType: Picklist;
  publish: Picklist;
}

// noteType/publish aus TicketNotes/entityInformation/fields (für die Aktivitäts-
// Anzeige). Ebenfalls LANG gecacht (6 h) – statische Metadaten, s. o.
export const getNotePicklists = unstable_cache(
  async (): Promise<NotePicklists> => {
    const fields = await autotask.fieldInfo("TicketNotes");
    const picklistOf = (name: string) =>
      fields.find((f) => f.name === name)?.picklistValues ?? null;
    return {
      noteType: activeOnly(picklistOf("noteType")),
      publish: activeOnly(picklistOf("publish")),
    };
  },
  ["note-picklists"],
  { revalidate: 21600 }, // 6 h
);
