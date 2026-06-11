"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderKanbanIcon, SearchIcon } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { TruncatedText } from "@/components/truncated-text";
import type { ProjectRow } from "@/lib/autotask/entities/projects";

// Projektliste für die neue Projekte-Seite. „Meine / Alle"-Umschalter (Server-Daten
// je Scope), Sofort-Clientsuche und dasselbe responsive Raster wie die Ticketlisten
// (Karten unter xl, volle Tabelle ab xl). Zusammengesetzt aus shadcn Table + Card-
// Hülle + Badge + Empty (keine erfundenen Widgets, nur semantische Tokens).

export type ProjectScope = "mine" | "all";

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

// Projekt-Status dezent (warm-achromatisch): „In Bearbeitung" (2) leicht betont
// (secondary), alle anderen neutral (outline). Kein lautes Rot – Projekte haben hier
// keinen Eskalationszustand.
function StatusBadge({ label, status }: { label: string | null; status?: number }) {
  if (!label) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant={status === 2 ? "secondary" : "outline"} className="font-normal">
      {label}
    </Badge>
  );
}

function CompanyCell({ row }: { row: ProjectRow }) {
  if (row.companyID == null || !row.companyName) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <Link
      href={`/companies/${row.companyID}`}
      className="hover:text-primary underline-offset-4 hover:underline"
    >
      <TruncatedText className="max-w-44">{row.companyName}</TruncatedText>
    </Link>
  );
}

export function ProjectsList({
  data,
  scope,
  myCount,
}: {
  data: ProjectRow[];
  scope: ProjectScope;
  // Anzahl „meiner" Projekte – am Umschalter angezeigt, auch im „Alle"-Blick.
  myCount: number;
}) {
  const router = useRouter();
  const [searchValue, setSearchValue] = React.useState("");

  const term = searchValue.trim().toLowerCase();
  const items = term
    ? data.filter(
        (p) =>
          (p.projectName ?? "").toLowerCase().includes(term) ||
          (p.projectNumber ?? "").toLowerCase().includes(term) ||
          (p.companyName ?? "").toLowerCase().includes(term),
      )
    : data;

  function selectScope(next: ProjectScope) {
    if (next === scope) return;
    router.push(next === "all" ? "/projekte?scope=all" : "/projekte");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {/* Umschalter Meine / Alle – gleiche Optik wie der „Alle / nicht zugewiesene"-
            Umschalter der Übersicht (zwei Buttons, aktiver = secondary). */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-11 sm:h-7"
            variant={scope === "mine" ? "secondary" : "outline"}
            onClick={() => selectScope("mine")}
          >
            Meine Projekte
            <Badge
              variant="secondary"
              className="bg-chart-2/15 text-chart-2 ml-1 tabular-nums"
            >
              {myCount}
            </Badge>
          </Button>
          <Button
            size="sm"
            className="h-11 sm:h-7"
            variant={scope === "all" ? "secondary" : "outline"}
            onClick={() => selectScope("all")}
          >
            Alle Projekte
          </Button>
        </div>

        <div className="relative w-full min-w-48 sm:max-w-xs">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Projekt, Nummer oder Firma suchen …"
            className="h-11 pl-9 sm:h-7"
            aria-label="Projekte suchen"
          />
        </div>
      </div>

      {items.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderKanbanIcon />
            </EmptyMedia>
            <EmptyTitle>Keine Projekte</EmptyTitle>
            <EmptyDescription>
              {term
                ? "Keine Treffer für die Suche."
                : scope === "mine"
                  ? "Du leitest aktuell kein Projekt und hast in keinem offenen Projekt eine Aufgabe."
                  : "Aktuell gibt es keine offenen Projekte."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {/* Mobile/Tablet: je Projekt eine Karte (kein Querscrollen). */}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:hidden">
            {items.map((p) => (
              <div
                key={p.id}
                className="bg-card flex flex-col gap-2 rounded-lg border p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 font-medium">
                    <TruncatedText>{p.projectName ?? "—"}</TruncatedText>
                  </span>
                  <StatusBadge label={p.statusLabel} status={p.status} />
                </div>
                <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  {p.projectNumber && (
                    <span className="tabular-nums">{p.projectNumber}</span>
                  )}
                  <CompanyCell row={p} />
                </div>
                <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs tabular-nums">
                  <span>Fortschritt: {formatPercent(p.completedPercentage)}</span>
                  <span>Fällig: {formatDate(p.endDateTime)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop ab xl: volle Tabelle. */}
          <div className="hidden overflow-x-auto rounded-lg border xl:block">
            <Table className="min-w-3xl">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Projekt</TableHead>
                  <TableHead>Nummer</TableHead>
                  <TableHead>Firma</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Leiter</TableHead>
                  <TableHead>Fortschritt</TableHead>
                  <TableHead>Fällig</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      <TruncatedText className="max-w-xs 2xl:max-w-md">
                        {p.projectName ?? "—"}
                      </TruncatedText>
                    </TableCell>
                    <TableCell className="tabular-nums whitespace-nowrap">
                      {p.projectNumber ?? "—"}
                    </TableCell>
                    <TableCell>
                      <CompanyCell row={p} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge label={p.statusLabel} status={p.status} />
                    </TableCell>
                    <TableCell>
                      <TruncatedText className="max-w-40">
                        {p.leadName ?? "—"}
                      </TruncatedText>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatPercent(p.completedPercentage)}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums whitespace-nowrap">
                      {formatDate(p.endDateTime)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
