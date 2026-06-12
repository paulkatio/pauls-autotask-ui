"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  FolderKanbanIcon,
  SearchIcon,
} from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { projectStatusVariant } from "@/lib/autotask/mappers";
import { cn } from "@/lib/utils";
import type { ProjectRow } from "@/lib/autotask/entities/projects";

// Projektliste. „Meine / Alle"-Umschalter (Server-Daten je Scope), Sofort-Clientsuche
// und – neu – echte Filter (Status/Leiter/Firma) plus Spalten-Sortierung, beide in den
// URL-Query gespiegelt (Refresh/Zurück/Teilen bleiben erhalten). Projektname ist ein
// echter Link auf die Detailseite (Cmd-/Mittelklick = neuer Tab). Zusammengesetzt aus
// shadcn Table + Select + Badge + Empty (keine erfundenen Widgets).

export type ProjectScope = "mine" | "all";

type SortKey = "name" | "due" | "progress";
type SortDir = "asc" | "desc";

const ALL = "all";

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

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// Überfällig = Fälligkeitstag liegt VOR heute (tagesbasiert, keine Uhrzeit) und das
// Projekt ist nicht abgeschlossen (status 5).
function isOverdue(iso?: string | null, status?: number): boolean {
  if (status === 5 || !iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return startOfDay(d) < startOfDay(new Date());
}

function StatusBadge({ label, status }: { label: string | null; status?: number }) {
  if (!label) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant={projectStatusVariant(status)} className="font-normal">
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

function ProjectNameLink({ row }: { row: ProjectRow }) {
  return (
    <Link
      href={`/projekte/${row.id}`}
      className="hover:text-primary font-medium underline-offset-4 hover:underline"
    >
      <TruncatedText className="max-w-xs 2xl:max-w-md">
        {row.projectName ?? "—"}
      </TruncatedText>
    </Link>
  );
}

function DueCell({ row }: { row: ProjectRow }) {
  const overdue = isOverdue(row.endDateTime, row.status);
  return (
    <span
      className={cn(
        "tabular-nums whitespace-nowrap",
        overdue ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {formatDate(row.endDateTime)}
      {overdue && (
        <Badge variant="outline" className="ml-2 font-normal">
          überfällig
        </Badge>
      )}
    </span>
  );
}

// Distinkte Filteroptionen aus den geladenen Zeilen ableiten (kein extra API-Call).
function distinctOptions(
  rows: ProjectRow[],
  keyOf: (r: ProjectRow) => number | null | undefined,
  labelOf: (r: ProjectRow) => string | null,
): { value: string; label: string }[] {
  const map = new Map<string, string>();
  for (const r of rows) {
    const k = keyOf(r);
    const label = labelOf(r);
    if (k == null || !label) continue;
    map.set(String(k), label);
  }
  return [...map.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "de"));
}

export function ProjectsList({
  data,
  scope,
  myCount,
  capped = false,
}: {
  data: ProjectRow[];
  scope: ProjectScope;
  // Anzahl „meiner" Projekte – am Umschalter angezeigt, auch im „Alle"-Blick.
  myCount: number;
  // Liste durch das Server-Limit gekürzt → Filter/Sortierung evtl. unvollständig.
  capped?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchValue, setSearchValue] = React.useState("");

  // Filter/Sortierung kommen aus dem URL-Query (einzige Wahrheit → Refresh + Teilen
  // bleiben erhalten). Bewusst `router.replace` (kein Verlaufseintrag je Filterklick),
  // d. h. Browser-Zurück verwirft die Filter in einem Schritt, statt sie einzeln
  // zurückzuspulen. `scope` bleibt eigener Server-Param und wird mitgeführt.
  const statusFilter = searchParams.get("status") ?? ALL;
  const leadFilter = searchParams.get("lead") ?? ALL;
  const companyFilter = searchParams.get("company") ?? ALL;
  // Aus der URL gelesene Sortierung defensiv validieren – ungültige Parameter
  // (?sort=xyz&dir=foo) fallen sauber auf Name/aufsteigend zurück.
  const sortParam = searchParams.get("sort");
  const sortKey: SortKey =
    sortParam === "due" || sortParam === "progress" ? sortParam : "name";
  const sortDir: SortDir = searchParams.get("dir") === "desc" ? "desc" : "asc";

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== ALL) params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function toggleSort(key: SortKey) {
    const params = new URLSearchParams(searchParams.toString());
    const nextDir: SortDir =
      sortKey === key && sortDir === "asc" ? "desc" : "asc";
    params.set("sort", key);
    params.set("dir", nextDir);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function selectScope(next: ProjectScope) {
    if (next === scope) return;
    // Scope-Wechsel verwirft die clientseitigen Filter (neue Datenbasis).
    router.push(next === "all" ? "/projekte?scope=all" : "/projekte");
  }

  const statusOptions = React.useMemo(
    () => distinctOptions(data, (r) => r.status, (r) => r.statusLabel),
    [data],
  );
  const leadOptions = React.useMemo(
    () => distinctOptions(data, (r) => r.projectLeadResourceID, (r) => r.leadName),
    [data],
  );
  const companyOptions = React.useMemo(
    () => distinctOptions(data, (r) => r.companyID, (r) => r.companyName),
    [data],
  );

  const term = searchValue.trim().toLowerCase();
  const items = React.useMemo(() => {
    const filtered = data.filter((p) => {
      if (statusFilter !== ALL && String(p.status ?? "") !== statusFilter)
        return false;
      if (
        leadFilter !== ALL &&
        String(p.projectLeadResourceID ?? "") !== leadFilter
      )
        return false;
      if (companyFilter !== ALL && String(p.companyID ?? "") !== companyFilter)
        return false;
      if (term) {
        const hay =
          `${p.projectName ?? ""} ${p.projectNumber ?? ""} ${p.companyName ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });

    const dir = sortDir === "desc" ? -1 : 1;
    const cmp = (a: ProjectRow, b: ProjectRow): number => {
      switch (sortKey) {
        case "due": {
          // Fehlende Fälligkeit immer ans Ende (unabhängig von der Richtung).
          const av = a.endDateTime ?? "";
          const bv = b.endDateTime ?? "";
          if (!av && !bv) return 0;
          if (!av) return 1;
          if (!bv) return -1;
          return av.localeCompare(bv) * dir;
        }
        case "progress": {
          // Fehlenden Fortschritt immer ans Ende (unabhängig von der Richtung) –
          // nicht als „-1 %" vor 0 % einsortieren.
          const av = a.completedPercentage;
          const bv = b.completedPercentage;
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return (av - bv) * dir;
        }
        default:
          return (a.projectName ?? "").localeCompare(b.projectName ?? "", "de") * dir;
      }
    };
    return [...filtered].sort(cmp);
  }, [data, statusFilter, leadFilter, companyFilter, term, sortKey, sortDir]);

  const hasFilter =
    statusFilter !== ALL || leadFilter !== ALL || companyFilter !== ALL || !!term;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
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

      {/* Filterleiste: Status / Leiter / Firma. Werte aus den geladenen Zeilen.
          Immer drei nebeneinander (je ein Drittel der Suchleistenbreite) – auch mobil. */}
      <div className="grid grid-cols-3 gap-2">
        <FilterSelect
          label="Status"
          value={statusFilter}
          options={statusOptions}
          allLabel="Alle Status"
          onChange={(v) => setParam("status", v)}
        />
        <FilterSelect
          label="Leiter"
          value={leadFilter}
          options={leadOptions}
          allLabel="Alle Leiter"
          onChange={(v) => setParam("lead", v)}
        />
        <FilterSelect
          label="Firma"
          value={companyFilter}
          options={companyOptions}
          allLabel="Alle Firmen"
          onChange={(v) => setParam("company", v)}
        />
      </div>

      {capped && (
        <p className="text-muted-foreground text-xs">
          Liste gekürzt – Suche, Filter und Sortierung beziehen sich auf die
          geladenen Projekte.
        </p>
      )}

      {items.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderKanbanIcon />
            </EmptyMedia>
            <EmptyTitle>Keine Projekte</EmptyTitle>
            <EmptyDescription>
              {hasFilter
                ? "Keine Treffer für die aktuelle Auswahl."
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
                  <span className="min-w-0">
                    <ProjectNameLink row={p} />
                  </span>
                  <StatusBadge label={p.statusLabel} status={p.status} />
                </div>
                <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  {p.projectNumber && (
                    <span className="tabular-nums">{p.projectNumber}</span>
                  )}
                  <CompanyCell row={p} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                  <span className="text-muted-foreground tabular-nums">
                    Fortschritt: {formatPercent(p.completedPercentage)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="text-muted-foreground">Fällig:</span>
                    <DueCell row={p} />
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop ab xl: volle Tabelle. */}
          <div className="hidden overflow-x-auto rounded-lg border xl:block">
            <Table className="min-w-3xl">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>
                    <SortHead
                      label="Projekt"
                      sortId="name"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    />
                  </TableHead>
                  <TableHead>Nummer</TableHead>
                  <TableHead>Firma</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Leiter</TableHead>
                  <TableHead>
                    <SortHead
                      label="Fortschritt"
                      sortId="progress"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    />
                  </TableHead>
                  <TableHead>
                    <SortHead
                      label="Fällig"
                      sortId="due"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onToggle={toggleSort}
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <ProjectNameLink row={p} />
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
                    <TableCell>
                      <DueCell row={p} />
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

// Sortierbarer Spaltenkopf. Modul-Komponente (kein Closure in der Liste), Zustand
// kommt über Props.
function SortHead({
  label,
  sortId,
  sortKey,
  sortDir,
  onToggle,
}: {
  label: string;
  sortId: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onToggle: (key: SortKey) => void;
}) {
  const active = sortKey === sortId;
  return (
    <button
      type="button"
      onClick={() => onToggle(sortId)}
      className="hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
      aria-label={`Nach ${label} sortieren`}
    >
      {label}
      {active &&
        (sortDir === "asc" ? (
          <ArrowUpIcon className="size-3.5" />
        ) : (
          <ArrowDownIcon className="size-3.5" />
        ))}
    </button>
  );
}

function FilterSelect({
  label,
  value,
  options,
  allLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  allLabel: string;
  onChange: (value: string) => void;
}) {
  // base-ui Select braucht `items`, damit der Trigger das Label (statt des Rohwerts)
  // anzeigt – inkl. der „Alle …"-Option.
  const items = [{ label: allLabel, value: ALL }, ...options];
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(v) => onChange(v ?? ALL)}
    >
      <SelectTrigger className="h-11 w-full min-w-0 sm:h-9" aria-label={label}>
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent>
        {items.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
