import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { TruncatedText } from "@/components/truncated-text";
import type { ProjectsPreview } from "@/lib/autotask/entities/projects";

// Kompakte „Meine Projekte"-Sektion auf der Übersicht (Top 5). Quelle ist
// getMyProjectsPreview – dieselbe gecachte Basis wie die KPI-Kachel, also ohne
// zusätzlichen Datenabruf. Reine Anzeige; tiefer geht es auf /projekte.

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

export function MyProjectsSection({ preview }: { preview: ProjectsPreview }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Meine Projekte</h2>
        <Link
          href="/projekte"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          Alle anzeigen
          <ArrowRightIcon className="size-4" />
        </Link>
      </div>

      {preview.items.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border p-4 text-sm">
          Du leitest aktuell kein Projekt und hast in keinem offenen Projekt eine
          Aufgabe.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {preview.items.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projekte/${p.id}`}
                className="hover:bg-muted/50 flex items-center justify-between gap-3 px-4 py-3 transition-colors"
              >
                <span className="flex min-w-0 flex-col">
                  <TruncatedText className="max-w-xs font-medium">
                    {p.projectName ?? "—"}
                  </TruncatedText>
                  {p.companyName && (
                    <TruncatedText className="text-muted-foreground max-w-xs text-xs">
                      {p.companyName}
                    </TruncatedText>
                  )}
                </span>
                <span className="text-muted-foreground flex shrink-0 items-center gap-4 text-xs tabular-nums">
                  <span>{formatPercent(p.completedPercentage)}</span>
                  <span className="whitespace-nowrap">
                    {formatDate(p.endDateTime)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
