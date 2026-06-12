import "server-only";

import { unstable_cache } from "next/cache";

import { autotask, type AutotaskFilter } from "@/lib/autotask/client";
import { companies } from "@/lib/autotask/entities/companies";
import { resources } from "@/lib/autotask/entities/resources";
import type { Project } from "@/lib/autotask/types";

// „Meine Projekte" + „Alle aktiven Projekte" für die neue Projekte-Seite und die
// Dashboard-Kachel. „Meine" = Projekte, die ich LEITE (projectLeadResourceID) ODER
// in denen mir eine Projektaufgabe (Tasks.assignedResourceID) zugewiesen ist – so
// ist die Ansicht sowohl aus Teamleitungs- als auch aus Mitarbeitersicht sinnvoll
// (Paul-Vorgabe). „Offen" = status != 5 (Abgeschlossen), analog zu Tickets.

const OPEN: AutotaskFilter = { op: "noteq", field: "status", value: 5 };
const IN_BLOCK = 300; // `in`-Operator defensiv in Blöcken (vgl. Dashboard B15).
const LEAD_CAP = 200; // Obergrenze der Lead-Projekte (MaxRecords der Lead-Query).
const ALL_CAP = 500; // Obergrenze „Alle aktiven Projekte".

// Listen-Rückgabe mit Cap-Hinweis: `capped` = die Obergrenze wurde erreicht, die
// Liste ist also evtl. unvollständig (wichtig, weil Suche/Filter/Sortierung
// clientseitig über die geladenen Zeilen laufen).
export interface ProjectListResult {
  rows: ProjectRow[];
  capped: boolean;
}

const PROJECT_FIELDS = [
  "id",
  "projectName",
  "projectNumber",
  "status",
  "companyID",
  "projectLeadResourceID",
  "completedPercentage",
  "startDateTime",
  "endDateTime",
  "lastActivityDateTime",
];

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Angereicherte Zeile für die Liste: Firmen- und Projektleiter-Name aufgelöst,
// Status-Label gemappt (für die Anzeige; gebündelt, kein N+1).
export interface ProjectRow extends Project {
  companyName: string | null;
  leadName: string | null;
  statusLabel: string | null;
}

// Projekt-Status-Picklist (eigene Liste der Projects-Entität). Selten geändert →
// lang gecacht (1 h). Map<value, label> für die Anzeige in der Liste.
async function fetchProjectStatusMap(): Promise<Record<number, string>> {
  const fields = await autotask.fieldInfo("Projects");
  const status = fields.find((f) => f.name === "status");
  const map: Record<number, string> = {};
  for (const v of status?.picklistValues ?? []) {
    const n = Number(v.value);
    if (Number.isFinite(n)) map[n] = v.label;
  }
  return map;
}

const getProjectStatusMap = unstable_cache(
  fetchProjectStatusMap,
  ["project-status-map"],
  { revalidate: 3600 },
);

// Distinct Projekt-IDs, in denen rid eine Projektaufgabe zugewiesen hat.
async function myTaskProjectIds(resourceId: number): Promise<number[]> {
  const rows = await autotask.query<{ projectID?: number | null }>(
    "Tasks",
    {
      MaxRecords: 500,
      IncludeFields: ["projectID"],
      Filter: [{ op: "eq", field: "assignedResourceID", value: resourceId }],
    },
    { autoPage: true },
  );
  return [
    ...new Set(
      rows
        .map((r) => r.projectID)
        .filter((n): n is number => typeof n === "number"),
    ),
  ];
}

// Rohe „meine offenen Projekte" (ohne Namensauflösung) – Basis für Liste UND Zähler.
// `capped` = die Lead-Obergrenze wurde erreicht (Liste evtl. unvollständig).
async function collectMyOpenProjects(
  resourceId: number,
): Promise<{ projects: Project[]; capped: boolean }> {
  const [lead, taskIds] = await Promise.all([
    autotask.query<Project>(
      "Projects",
      {
        MaxRecords: LEAD_CAP,
        IncludeFields: PROJECT_FIELDS,
        Filter: [
          { op: "eq", field: "projectLeadResourceID", value: resourceId },
          OPEN,
        ],
      },
      { autoPage: false },
    ),
    myTaskProjectIds(resourceId),
  ]);

  const leadIds = new Set(lead.map((p) => p.id));
  const extraIds = taskIds.filter((id) => !leadIds.has(id));

  let extra: Project[] = [];
  if (extraIds.length > 0) {
    const blocks = await Promise.all(
      chunk(extraIds, IN_BLOCK).map((b) =>
        autotask.query<Project>(
          "Projects",
          {
            MaxRecords: IN_BLOCK,
            IncludeFields: PROJECT_FIELDS,
            // status != 5 hier ebenfalls erzwingen – abgeschlossene Projekte mit
            // einer alten Task-Zuweisung gehören nicht in „meine offenen Projekte".
            Filter: [{ op: "in", field: "id", value: b }, OPEN],
          },
          { autoPage: false },
        ),
      ),
    );
    extra = blocks.flat();
  }

  return { projects: [...lead, ...extra], capped: lead.length >= LEAD_CAP };
}

async function enrich(rows: Project[]): Promise<ProjectRow[]> {
  const [companyNames, leadNames, statusMap] = await Promise.all([
    companies.namesByIds(
      rows
        .map((p) => p.companyID)
        .filter((n): n is number => typeof n === "number"),
    ),
    resources.namesByIds(
      rows
        .map((p) => p.projectLeadResourceID)
        .filter((n): n is number => typeof n === "number"),
    ),
    getProjectStatusMap(),
  ]);
  return rows
    .map((p) => ({
      ...p,
      companyName:
        p.companyID != null ? (companyNames.get(p.companyID) ?? null) : null,
      leadName:
        p.projectLeadResourceID != null
          ? (leadNames.get(p.projectLeadResourceID) ?? null)
          : null,
      statusLabel: p.status != null ? (statusMap[p.status] ?? null) : null,
    }))
    .sort((a, b) =>
      (a.projectName ?? "").localeCompare(b.projectName ?? "", "de"),
    );
}

// „Meine" Projekte (Leiter oder eigene Tasks), angereichert + Cap-Hinweis. 60 s
// gecacht pro Resource. EINZIGE Quelle für „meine Projekte": Liste, Zähler und
// Dashboard-Vorschau leiten sich alle hieraus ab (ein Collect statt mehrerer).
export function getMyProjects(resourceId: number): Promise<ProjectListResult> {
  return unstable_cache(
    async (): Promise<ProjectListResult> => {
      const { projects, capped } = await collectMyOpenProjects(resourceId);
      return { rows: await enrich(projects), capped };
    },
    ["my-projects", String(resourceId)],
    { revalidate: 60 },
  )();
}

// Zähler für die Dashboard-Kachel (aus derselben gecachten Quelle wie getMyProjects).
export async function countMyOpenProjects(resourceId: number): Promise<number> {
  return (await getMyProjects(resourceId)).rows.length;
}

// Kompakte Vorschau für die Dashboard-Sektion „Meine Projekte" (Top 5 + Gesamtzahl) –
// ebenfalls aus getMyProjects, also ohne zusätzlichen Datenabruf.
export interface ProjectsPreview {
  count: number;
  items: ProjectRow[];
}

export async function getMyProjectsPreview(
  resourceId: number,
): Promise<ProjectsPreview> {
  const { rows } = await getMyProjects(resourceId);
  return { count: rows.length, items: rows.slice(0, 5) };
}

// Alle aktiven Projekte (team-weit, status != 5) – für den „Alle"-Blick. Gedeckelt
// auf 500 (mit Cap-Hinweis), 60 s gecacht (team-weit, kein Resource-Schlüssel nötig).
export const getAllActiveProjects = unstable_cache(
  async (): Promise<ProjectListResult> => {
    const rows = await autotask.query<Project>(
      "Projects",
      {
        MaxRecords: ALL_CAP,
        IncludeFields: PROJECT_FIELDS,
        Filter: [OPEN],
      },
      { maxItems: ALL_CAP },
    );
    return { rows: await enrich(rows), capped: rows.length >= ALL_CAP };
  },
  ["all-active-projects"],
  { revalidate: 60 },
);
