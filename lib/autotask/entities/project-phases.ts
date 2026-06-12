import "server-only";

import { autotask } from "@/lib/autotask/client";
import type { ProjectPhase } from "@/lib/autotask/types";

// Projektphasen (REST-Entität `Phases`, Filter `projectID` – verifiziert 2026-06-12).
// Reine Leseansicht für den „Phasen"-Tab. `parentPhaseID` markiert Unterphasen, die
// in der UI eingerückt dargestellt werden.

const PHASE_FIELDS = [
  "id",
  "projectID",
  "title",
  "startDate",
  "dueDate",
  "estimatedHours",
  "parentPhaseID",
];

// Phasen eines Projekts, nach Startdatum sortiert (Eltern vor Unterphasen bleibt der
// UI überlassen; hier nur die zeitliche Reihenfolge).
export async function getProjectPhases(
  projectId: number,
): Promise<ProjectPhase[]> {
  // Auf eine Seite (max. 500) begrenzt – kein unbegrenztes Auto-Paging.
  const rows = await autotask.query<ProjectPhase>(
    "Phases",
    {
      MaxRecords: 500,
      IncludeFields: PHASE_FIELDS,
      Filter: [{ op: "eq", field: "projectID", value: projectId }],
    },
    { autoPage: false },
  );

  return rows.sort((a, b) =>
    (a.startDate ?? "").localeCompare(b.startDate ?? ""),
  );
}
