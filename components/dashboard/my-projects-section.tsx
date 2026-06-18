import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";

import { TruncatedText } from "@/components/truncated-text";
import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card";
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
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold tracking-tight">Meine Projekte</h2>
        <CardAction>
          <Link
            href="/projekte"
            className="text-muted-foreground hover:text-foreground inline-flex h-11 items-center gap-1 text-sm sm:h-auto"
          >
            Alle anzeigen
            <ArrowRight className="size-4" />
          </Link>
        </CardAction>
      </CardHeader>

      <CardContent className="px-0">
        {preview.items.length === 0 ? (
          <p className="text-muted-foreground px-4 text-sm">
            Du leitest aktuell kein Projekt und hast in keinem offenen Projekt
            eine Aufgabe.
          </p>
        ) : (
          <ul className="divide-y">
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
                  <span className="flex items-center gap-2">
                    {p.completedPercentage != null &&
                      Number.isFinite(p.completedPercentage) && (
                        <span
                          aria-hidden
                          className="bg-muted h-1.5 w-16 overflow-hidden rounded-full"
                        >
                          <span
                            className="bg-foreground block h-full rounded-full"
                            style={{
                              width: `${Math.max(0, Math.min(100, Math.round(p.completedPercentage)))}%`,
                            }}
                          />
                        </span>
                      )}
                    <span>{formatPercent(p.completedPercentage)}</span>
                  </span>
                  <span className="whitespace-nowrap">
                    {formatDate(p.endDateTime)}
                  </span>
                </span>
              </Link>
            </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
