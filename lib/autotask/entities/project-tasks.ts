import "server-only";

import { unstable_cache } from "next/cache";

import { autotask } from "@/lib/autotask/client";
import { resources } from "@/lib/autotask/entities/resources";
import type { ProjectTask } from "@/lib/autotask/types";

// Projektaufgaben (REST-Entität `Tasks`, Filter `projectID` – verifiziert 2026-06-12).
// Reine Leseansicht für den „Aufgaben"-Tab der Projektdetailseite. `Tasks.status` ist
// eine EIGENE Picklist (1 Neu / 2 In Bearbeitung / 5 Abgeschlossen …), daher separat
// gemappt – NICHT mit Projects.status verwechseln.

const TASK_FIELDS = [
  "id",
  "projectID",
  "title",
  "status",
  "assignedResourceID",
  "endDateTime",
];

export interface ProjectTaskRow extends ProjectTask {
  assignedName: string | null;
  statusLabel: string | null;
}

// Tasks-Status-Picklist (eigene Liste). Statische Metadaten → lang gecacht (6 h),
// gleiche Last-Vorsicht wie bei den übrigen Feld-Infos.
async function fetchTaskStatusMap(): Promise<Record<number, string>> {
  const fields = await autotask.fieldInfo("Tasks");
  const status = fields.find((f) => f.name === "status");
  const map: Record<number, string> = {};
  for (const v of status?.picklistValues ?? []) {
    const n = Number(v.value);
    if (Number.isFinite(n)) map[n] = v.label;
  }
  return map;
}

const getTaskStatusMap = unstable_cache(fetchTaskStatusMap, ["task-status-map"], {
  revalidate: 21600,
});

// Aufgaben eines Projekts, angereichert (Name der zugewiesenen Resource + Status-Label).
export async function getProjectTasks(
  projectId: number,
): Promise<ProjectTaskRow[]> {
  // Auf eine Seite (max. 500) begrenzt – kein unbegrenztes Auto-Paging. Mehr als 500
  // Aufgaben in einem Projekt sind hier praktisch ausgeschlossen; die Deckelung schützt
  // nur den Worst Case (analog zur Projektliste).
  const rows = await autotask.query<ProjectTask>(
    "Tasks",
    {
      MaxRecords: 500,
      IncludeFields: TASK_FIELDS,
      Filter: [{ op: "eq", field: "projectID", value: projectId }],
    },
    { autoPage: false },
  );

  const [names, statusMap] = await Promise.all([
    resources.namesByIds(
      rows
        .map((t) => t.assignedResourceID)
        .filter((n): n is number => typeof n === "number"),
    ),
    getTaskStatusMap(),
  ]);

  return rows
    .map((t) => ({
      ...t,
      assignedName:
        t.assignedResourceID != null
          ? (names.get(t.assignedResourceID) ?? null)
          : null,
      statusLabel: t.status != null ? (statusMap[t.status] ?? null) : null,
    }))
    .sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "", "de"));
}
