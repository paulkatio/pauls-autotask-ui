import "server-only";

import { unstable_cache } from "next/cache";

import { autotask, type AutotaskFilter } from "@/lib/autotask/client";
import { companies } from "@/lib/autotask/entities/companies";
import { resources } from "@/lib/autotask/entities/resources";
import { getProjectPicklists } from "@/lib/autotask/entities/picklists";
import { labelOf } from "@/lib/autotask/mappers";
import type { Project } from "@/lib/autotask/types";

// Projektdetail (Vorbild: ticket-detail.ts / company-detail). Lädt den vollen
// Projektdatensatz + aufgelöste Firmen-/Leiter-Namen + Status-/Typ-Label. Die
// Voll-Listen für Aufgaben/Phasen werden NICHT hier geladen, sondern erst beim
// aktiven Tab (project-tasks.ts / project-phases.ts) – analog zur Kundenakte, die
// nur den aktiven Tab lädt.

export interface ProjectDetail {
  project: Project;
  companyName: string | null;
  leadName: string | null;
  statusLabel: string | null;
  typeLabel: string | null;
}

export async function getProjectDetail(
  id: number,
): Promise<ProjectDetail | null> {
  const project = await autotask.get<Project>("Projects", id);
  if (!project) return null;

  const [companyName, leadName, picklists] = await Promise.all([
    project.companyID != null
      ? companies
          .namesByIds([project.companyID])
          .then((m) => m.get(project.companyID as number) ?? null)
      : Promise.resolve(null),
    project.projectLeadResourceID != null
      ? resources
          .namesByIds([project.projectLeadResourceID])
          .then((m) => m.get(project.projectLeadResourceID as number) ?? null)
      : Promise.resolve(null),
    getProjectPicklists(),
  ]);

  return {
    project,
    companyName,
    leadName,
    statusLabel:
      project.status != null ? labelOf(picklists.status, project.status) : null,
    typeLabel:
      project.projectType != null
        ? labelOf(picklists.projectType, project.projectType)
        : null,
  };
}

// Leichte Zähler für die KPI-Kacheln im Detail-Header (count-Endpoint, kein
// Vollabruf). 60 s gecacht je Projekt. „Offen" bei Aufgaben = status != 5.
export interface ProjectStats {
  tasksOpen: number;
  tasksTotal: number;
  phases: number;
}

export function getProjectStats(id: number): Promise<ProjectStats> {
  return unstable_cache(
    async (): Promise<ProjectStats> => {
      const byProject: AutotaskFilter = {
        op: "eq",
        field: "projectID",
        value: id,
      };
      const [tasksTotal, tasksOpen, phases] = await Promise.all([
        autotask.count("Tasks", [byProject]),
        autotask.count("Tasks", [
          byProject,
          { op: "noteq", field: "status", value: 5 },
        ]),
        autotask.count("Phases", [byProject]),
      ]);
      return { tasksOpen, tasksTotal, phases };
    },
    ["project-stats", String(id)],
    { revalidate: 60 },
  )();
}
