import Link from "next/link";

import { TruncatedText } from "@/components/truncated-text";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ProjectsPreview } from "@/lib/autotask/entities/projects";

// Maximale Zahl Einträge im Dashboard-Panel. Mehr Projekte werden NICHT gerendert
// (kein unbegrenztes Wachsen, kein interner Scroll) – der Rest hängt am Footer-
// Button „Alle Projekte ansehen". Die Vorschau liefert bereits nach Fälligkeit
// sortiert (dringendste zuerst), hier wird nur noch gedeckelt.
const MAX_ITEMS = 5;

// Kompakte „Meine Projekte"-Sektion auf der Übersicht (Top N). Quelle ist
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
  const items = preview.items.slice(0, MAX_ITEMS);

  return (
    // h-full: füllt die gestreckte Grid-Spalte und ist damit so hoch wie das Diagramm
    // daneben – auch bei NUR EINEM Projekt (sonst war die Karte zu niedrig,
    // Paul-Feedback). Bei VIELEN Projekten verhindert der Scroll-Deckel der Liste
    // (max-h) unten, dass die Karte das Diagramm in die Höhe zieht.
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Meine Projekte</CardTitle>
        <CardDescription>
          Geleitet oder bearbeitet, nach Fälligkeit.
        </CardDescription>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 overflow-y-auto px-0">
        {items.length === 0 ? (
          <p className="text-muted-foreground px-4 text-sm">
            Du leitest aktuell kein Projekt und hast in keinem offenen Projekt
            eine Aufgabe.
          </p>
        ) : (
          <ul className="divide-y">
            {items.map((p) => {
              const pct =
                p.completedPercentage != null &&
                Number.isFinite(p.completedPercentage)
                  ? Math.max(0, Math.min(100, Math.round(p.completedPercentage)))
                  : null;
              return (
                <li key={p.id}>
                  <Link
                    href={`/projekte/${p.id}`}
                    className="hover:bg-muted/50 flex flex-col gap-2 px-4 py-3 transition-colors"
                  >
                    {/* Titel + Kunde gestapelt – passt in die schmale Spalte.
                        Titel bricht bei schmaler Breite mehrzeilig um (kein
                        Abschneiden); Kunde bleibt einzeilig (truncate). */}
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-medium break-words">
                        {p.projectName ?? "—"}
                      </span>
                      {p.companyName && (
                        <TruncatedText className="text-muted-foreground text-xs">
                          {p.companyName}
                        </TruncatedText>
                      )}
                    </span>

                    {/* Dünner Fortschrittsbalken über die volle Spaltenbreite */}
                    <span
                      aria-hidden
                      className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
                    >
                      <span
                        className="bg-foreground block h-full rounded-full"
                        style={{ width: `${pct ?? 0}%` }}
                      />
                    </span>

                    {/* Prozent links, Datum rechts */}
                    <span className="text-muted-foreground flex items-center justify-between gap-3 text-xs tabular-nums">
                      <span>{formatPercent(p.completedPercentage)}</span>
                      <span className="whitespace-nowrap">
                        {formatDate(p.endDateTime)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      {/* Footer-Bereich ohne den muted-Hintergrund von CardFooter (sonst zu wenig
          Kontrast zum Button). Gleicher Button wie unter „Offene Tickets". */}
      <CardFooter className="bg-transparent">
        <Button
          variant="outline"
          nativeButton={false}
          className="h-11 w-full sm:h-9"
          render={<Link href="/projekte" />}
        >
          Alle Projekte ansehen
        </Button>
      </CardFooter>
    </Card>
  );
}
