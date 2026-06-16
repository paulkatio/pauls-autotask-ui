import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarRangeIcon,
  ChevronLeftIcon,
  GaugeIcon,
  LayersIcon,
  ListTodoIcon,
  type LucideIcon,
} from "lucide-react";

import { getSession } from "@/lib/auth";
import {
  getProjectDetail,
  getProjectStats,
  type ProjectStats,
} from "@/lib/autotask/entities/project-detail";
import { getProjectTasks } from "@/lib/autotask/entities/project-tasks";
import { getProjectPhases } from "@/lib/autotask/entities/project-phases";
import { getAssignableResources } from "@/lib/autotask/entities/resources";
import { loadOrError } from "@/lib/data/load-or-error";
import { autotaskProjectUrl } from "@/lib/autotask/links";
import { projectStatusVariant } from "@/lib/autotask/mappers";
import { AutotaskOpenButton } from "@/components/autotask-open-button";
import { ProjectMetaEdit } from "@/components/projects/project-meta-edit";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { ProjectTasksPanel } from "@/components/projects/project-tasks-panel";
import { ProjectPhasesPanel } from "@/components/projects/project-phases-panel";
import { DataError } from "@/components/data-error";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Projektdetailseite. Kopf (Name/Nummer/Firma/Status) + Meta (Leiter/Typ/Zeitraum) +
// KPI-Kacheln (Fortschritt/Aufgaben/Phasen/Fällig) + Tabs (Aufgaben/Phasen). Nach dem
// Muster der Kundenakte: nur der AKTIVE Tab wird serverseitig geladen.

const VALID_TABS = ["aufgaben", "phasen"] as const;
type Tab = (typeof VALID_TABS)[number];

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function formatPercent(n?: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n)} %`;
}

export async function ProjectDetailContent({
  projectId,
  tabParam,
}: {
  projectId: number;
  tabParam?: string;
}) {
  if (!Number.isFinite(projectId)) notFound();

  const session = await getSession();
  if (!session) return null;

  const tab: Tab = (VALID_TABS as readonly string[]).includes(tabParam ?? "")
    ? (tabParam as Tab)
    : "aufgaben";

  const detailRes = await loadOrError(() => getProjectDetail(projectId));
  if (!detailRes.ok)
    return (
      <DataError
        title="Projekt konnte nicht geladen werden"
        rateLimited={detailRes.rateLimited}
      />
    );
  const detail = detailRes.data;
  if (!detail) notFound();
  const { project, companyName, leadName, statusLabel, typeLabel } = detail;

  let stats: ProjectStats | null = null;
  try {
    stats = await getProjectStats(projectId);
  } catch {
    stats = null;
  }

  // Bearbeiten nur, wenn der Schreib-Guard aktiv ist (PROJECT_WRITES_ENABLED) – sonst
  // bleibt die Detailseite read-only (passend zum Schreib-Gate, s. DECISIONS.md).
  const editable = process.env.PROJECT_WRITES_ENABLED === "1";
  let resources: Awaited<ReturnType<typeof getAssignableResources>> | null = null;
  if (editable) {
    try {
      resources = await getAssignableResources();
    } catch {
      resources = null;
    }
  }

  let panel: React.ReactNode;
  if (tab === "phasen") {
    const r = await loadOrError(() => getProjectPhases(projectId));
    panel = r.ok ? (
      <ProjectPhasesPanel rows={r.data} />
    ) : (
      <DataError
        title="Daten konnten nicht geladen werden"
        rateLimited={r.rateLimited}
      />
    );
  } else {
    const r = await loadOrError(() => getProjectTasks(projectId));
    panel = r.ok ? (
      <ProjectTasksPanel rows={r.data} />
    ) : (
      <DataError
        title="Daten konnten nicht geladen werden"
        rateLimited={r.rateLimited}
      />
    );
  }

  const title = project.projectName ?? `Projekt ${projectId}`;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/projekte"
        className="text-muted-foreground hover:text-foreground hidden items-center gap-1 text-sm md:inline-flex"
      >
        <ChevronLeftIcon className="size-4" />
        Projekte
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          {project.projectNumber && (
            <span className="text-muted-foreground text-xs tabular-nums">
              {project.projectNumber}
            </span>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-balance break-words">
            {title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {statusLabel && (
              <Badge
                variant={projectStatusVariant(project.status)}
                className="font-normal"
              >
                {statusLabel}
              </Badge>
            )}
            {companyName && project.companyID != null && (
              <Link
                href={`/companies/${project.companyID}`}
                className="text-muted-foreground hover:text-primary min-w-0 break-words underline-offset-4 hover:underline"
              >
                {companyName}
              </Link>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* „In Autotask öffnen" – Desktop. Mobil liefert ihn die App-Kopfzeile
              (HeaderAutotaskLink), daher hier md:inline-flex. */}
          <AutotaskOpenButton
            href={autotaskProjectUrl(projectId)}
            label="In Autotask öffnen"
            className="hidden md:inline-flex"
          />
        </div>
      </div>

      {/* Bearbeitbare Projektdaten (Status/Leiter/Zeitraum/Fortschritt) – oder, wenn
          der Schreib-Guard aus ist, dieselben Felder read-only als Meta-Zeile. */}
      {editable && resources ? (
        <ProjectMetaEdit
          project={project}
          projectName={title}
          resources={resources}
          statusLabel={statusLabel}
          typeLabel={typeLabel}
        />
      ) : (
        <div className="text-muted-foreground flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <MetaItem label="Projektleiter" value={leadName ?? "—"} />
          <MetaItem label="Typ" value={typeLabel ?? "—"} />
          <MetaItem
            label="Zeitraum"
            value={`${formatDate(project.startDateTime)} – ${formatDate(project.endDateTime)}`}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Fortschritt"
          value={formatPercent(project.completedPercentage)}
          icon={GaugeIcon}
        />
        <StatCard
          title="Aufgaben offen"
          value={
            stats ? `${stats.tasksOpen} / ${stats.tasksTotal}` : "—"
          }
          icon={ListTodoIcon}
          href="?tab=aufgaben"
        />
        <StatCard
          title="Phasen"
          value={stats ? stats.phases : "—"}
          icon={LayersIcon}
          href="?tab=phasen"
        />
        <StatCard
          title="Fällig"
          value={formatDate(project.endDateTime)}
          icon={CalendarRangeIcon}
        />
      </div>

      {project.description && (
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-medium">
            Beschreibung
          </span>
          <p className="text-sm break-words whitespace-pre-wrap">
            {project.description}
          </p>
        </div>
      )}

      <ProjectTabs active={tab}>{panel}</ProjectTabs>
    </div>
  );
}

export async function projectMetadata(id: number): Promise<Metadata> {
  if (!Number.isFinite(id)) return { title: "Projekt" };
  try {
    const detail = await getProjectDetail(id);
    return { title: detail?.project.projectName ?? `Projekt #${id}` };
  } catch {
    return { title: `Projekt #${id}` };
  }
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-xs">{label}</span>
      <span className="text-foreground break-words">{value}</span>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  href,
}: {
  title: string;
  value: number | string;
  icon: LucideIcon;
  href?: string;
}) {
  const card = (
    <Card className="h-full">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">
          {value}
        </CardTitle>
        <CardAction>
          <Icon className="text-muted-foreground" />
        </CardAction>
      </CardHeader>
    </Card>
  );

  if (!href) return card;
  return (
    <Link
      href={href}
      scroll={false}
      className="focus-visible:ring-ring focus-visible:ring-offset-background block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      <Card className="group-hover:border-primary/40 h-full transition-all hover:border-primary/40 hover:shadow-md">
        <CardHeader>
          <CardDescription>{title}</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {value}
          </CardTitle>
          <CardAction>
            <Icon className="text-muted-foreground group-hover:text-primary" />
          </CardAction>
        </CardHeader>
      </Card>
    </Link>
  );
}
