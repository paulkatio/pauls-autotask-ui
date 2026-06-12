import { AlertCircleIcon } from "lucide-react";

import { getSession } from "@/lib/auth";
import {
  getMyProjects,
  getAllActiveProjects,
} from "@/lib/autotask/entities/projects";
import { AutotaskError } from "@/lib/autotask/client";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/page-header";
import { ProjectsList, type ProjectScope } from "@/components/projects/projects-list";

export const dynamic = "force-dynamic";

// Projekte-Seite. „Meine" (Projekte, die ich leite ODER in denen mir eine Aufgabe
// zugewiesen ist) und „Alle" (alle offenen Team-Projekte) über den Umschalter in der
// Liste – aus Mitarbeiter- UND Teamleitungssicht nutzbar (Paul-Vorgabe).
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  if (!session) return null;

  const scope: ProjectScope = sp.scope === "all" ? "all" : "mine";
  const rid = session.autotaskResourceId;

  try {
    // „Meine" immer laden (Umschalter-Badge + Quelle im „Mine"-Blick); im „Alle"-Blick
    // zusätzlich die Team-Liste. getMyProjects ist 60 s gecacht → der Doppelbezug im
    // Mine-Blick kostet nichts.
    const mine = await getMyProjects(rid);
    const scoped = scope === "all" ? await getAllActiveProjects() : mine;

    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Projekte"
          description="Projekte, die du leitest oder in denen du mitarbeitest – plus der Blick auf alle aktiven Projekte."
          badge={mine.rows.length}
        />
        <ProjectsList
          data={scoped.rows}
          scope={scope}
          myCount={mine.rows.length}
          capped={scoped.capped}
        />
      </div>
    );
  } catch (e) {
    const rateLimited = e instanceof AutotaskError && e.status === 429;
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>Projekte konnten nicht geladen werden</AlertTitle>
        <AlertDescription>
          {rateLimited
            ? "Rate-Limit erreicht (429). Bitte kurz warten und erneut versuchen."
            : "Bitte später erneut versuchen."}
        </AlertDescription>
      </Alert>
    );
  }
}
