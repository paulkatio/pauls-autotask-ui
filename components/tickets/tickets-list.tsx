"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Ticket as TicketIcon, ArrowCounterClockwise } from "@phosphor-icons/react/ssr";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchInput } from "@/components/ui/search-input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { TableSkeleton } from "@/components/skeletons";
import { DataError } from "@/components/data-error";
import { BulkBar } from "@/components/tickets/bulk-bar";
import { TruncatedText } from "@/components/truncated-text";
import { useColumnOrder } from "@/hooks/use-column-order";
import { cn } from "@/lib/utils";
import { labelOf } from "@/lib/autotask/mappers";
import { PriorityBadge } from "@/components/priority-indicator";
import { StatusBadge } from "@/components/status-indicator";
import { TicketCard } from "@/components/tickets/ticket-card";
import { ResourceFilter } from "@/components/tickets/resource-filter";
import { useTableSort, type SortValue } from "@/hooks/use-table-sort";
import { SortIcon } from "@/components/table-sort-icon";
import type { Ticket, TicketPicklists } from "@/lib/autotask/types";
import type { ResourceOption } from "@/lib/autotask/entities/resources";
import { useRecordNav } from "@/hooks/use-record-nav";
import { useProgressNav } from "@/hooks/use-progress-nav";

// Gemeinsame, parametrisierbare Ticket-Liste für "Meine Tickets" (B07) und
// "Teamtickets" (B12). Datenquelle/Filter kommen serverseitig; die Spalten
// "Queue"/"Zugewiesen"/"Firma" werden per `columns` ein-/ausgeblendet.
export type TicketRow = Ticket & {
  companyName: string | null;
  assignedResourceName?: string | null;
};

// Textsuche (Paul-Feedback):
//  - "server": Suchfeld + sofort-Clientfilter der aktuellen Seite + debounced ?q=
//    (die Seite mischt ticketSearchFilter ein -> volle, seitenübergreifende Suche).
//  - "client": nur Clientfilter der geladenen Zeilen (für kuratierte Einzelseiten).
//  - "off": kein Suchfeld.
type SearchMode = "server" | "client" | "off";

// Geladene Tickets (eine Seite/Liste). `capped`/`total` optional – nur die vollen
// Listen (getTicketsAll) liefern sie, für die Hinweiszeile „sehr viele Tickets".
type TicketsData = {
  items: TicketRow[];
  // Cursors optional: die vollen Listen (getTicketsAll) liefern keine; die gepagten/
  // kuratierten Konsumenten setzen sie (oder null).
  nextCursor?: string | null;
  prevCursor?: string | null;
  capped?: boolean;
  total?: number;
};

// Lade-Ergebnis (spiegelt loadOrError): die STREAMENDEN Seiten reichen das Promise
// direkt herein, ohne zu awaiten -> die Toolbar (Suche + Filterchips) rendert sofort,
// nur die Tabelle hängt am Promise (Suspense). Fehler werden hier zu einem Ergebnis
// (kein Throw) -> die Tabelle zeigt die DataError-Kachel statt die Seite zu kippen.
type LoadState =
  | { ok: true; data: TicketsData }
  | { ok: false; rateLimited: boolean };

// Eingang: entweder bereits aufgelöste Daten (clientseitige/kuratierte Konsumenten
// wie Dashboard, Kundenakte, Ball) ODER ein Promise<LoadState> (streamende Server-
// Seiten Meine/Team). Beides wird intern auf EIN Promise<LoadState> normalisiert.
type TicketsInput = TicketsData | Promise<LoadState>;

function isThenable(v: unknown): v is Promise<LoadState> {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { then?: unknown }).then === "function"
  );
}

interface Props {
  data: TicketsInput;
  picklists: TicketPicklists;
  filters: { status: string; priority: string; queue: string; assigned?: string };
  columns?: { queue?: boolean; assigned?: boolean; company?: boolean };
  assignmentFilter?: boolean; // Team: "Alle / nur nicht zugewiesene"
  // Team: Mitarbeiter-Mehrfachfilter statt Queue-Filter. Standardmäßig sind alle
  // Mitarbeiter ausgewählt, außer den hier genannten (z. B. Philipp König). Wirkt
  // clientseitig auf die geladene Liste (Team lädt alles in einem Rutsch).
  resourceFilter?: boolean;
  defaultDeselectedResourceIds?: number[];
  showFilters?: boolean; // Fokuslisten (Dashboard) blenden die Filterleiste aus
  showPager?: boolean; // und das Paging
  mobileLimit?: number; // Dashboard: Karten-Stack mobil deckeln (Tabelle bleibt komplett)
  mobileOverflowHint?: boolean; // „+ N weitere …" unter dem gedeckelten Stack (Default an)
  searchMode?: SearchMode;
  emptyDescription?: string;
  // Mehrfachauswahl + Bulk-Aktionen (an in Meine/Team/Kundenakte/Kontakt-Tabs,
  // aus in den Dashboard-Minilisten). Auswahl gilt pro Seite, leert bei Seiten-/
  // Filterwechsel. Benötigt Resources + die eigene Resource-ID ("Mir zuweisen").
  selectable?: boolean;
  resources?: ResourceOption[];
  myResourceId?: number;
  // Eigener Rahmen um Tabelle/Karten. Default an. Aus, wenn die Liste bereits in
  // einer umgebenden Karte sitzt (Übersicht) – verhindert Karte-in-Karte.
  bordered?: boolean;
  // Kompakte Tabelle (Übersicht): schmalere Titel-Spalte und keine erzwungene
  // Mindestbreite, damit die Tabelle in die Karte passt und „Fällig" ohne
  // Rechts-Scrollen sichtbar bleibt. Default aus (volle Listen unverändert).
  compact?: boolean;
  // Nachladen nach einer Bulk-Aktion. Default: router.refresh() (serverseitig
  // gerenderte Listen wie Meine/Team). Clientseitig gefütterte Listen (die
  // Dashboard-Übersicht) reichen hier ihr eigenes Nachladen herein, damit die
  // Liste aktuell wird, ohne die ganze Seite neu aufzubauen.
  onBulkApplied?: () => void;
}

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

function setsEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

// Datum -> sortierbarer Zeitstempel (ungültig/leer -> null, landet beim Sortieren hinten).
function dateSortValue(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

// Überfällig = Fälligkeitstag liegt VOR dem heutigen Tag (kalendarisch, nicht
// uhrzeitgenau – „heute fällig" gilt nicht als überfällig).
function isOverdue(iso?: string | null): boolean {
  if (!iso) return false;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return false;
  const due = new Date(ms);
  const now = new Date();
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return dueDay.getTime() < today.getTime();
}

// Persistenz des Mitarbeiter-Filters (Team): wir speichern die ABGEWÄHLTEN IDs in
// localStorage, damit die getroffene Auswahl Sitzungen/Reloads übersteht. Fehlt ein
// gespeicherter Wert, greift der Standard (alle außer Philipp König).
const RESOURCE_FILTER_STORAGE_KEY = "tickets:team:resource-filter:deselected:v1";

function loadDeselectedResources(): Set<number> | null {
  try {
    const raw = localStorage.getItem(RESOURCE_FILTER_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return new Set(parsed.filter((n): n is number => typeof n === "number"));
  } catch {
    return null;
  }
}

function persistDeselectedResources(ids: Set<number>): void {
  try {
    localStorage.setItem(RESOURCE_FILTER_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage nicht verfügbar -> Auswahl bleibt nur für diese Sitzung.
  }
}

// Spalten-Definition (Tabelle). Daten-UNABHÄNGIG aufbaubar (nur picklists/columns):
// die Defs entstehen im Eltern-Render, die Zell-Funktionen bekommen pro Zeile das
// Ticket – so kann die Toolbar (Spalten-Reset) ohne die geladenen Daten rendern.
type ColumnDef = {
  id: string;
  header: string;
  cell: (t: TicketRow) => React.ReactNode;
  headClass?: string;
  sortValue?: (t: TicketRow) => SortValue;
};

export function TicketsList({
  data,
  picklists,
  filters,
  columns = {},
  assignmentFilter = false,
  resourceFilter = false,
  defaultDeselectedResourceIds,
  showFilters = true,
  showPager = true,
  mobileLimit,
  mobileOverflowHint = true,
  searchMode = "server",
  emptyDescription = "Für die aktuelle Auswahl gibt es keine Tickets.",
  selectable = false,
  resources,
  myResourceId,
  bordered = true,
  compact = false,
  onBulkApplied,
}: Props) {
  const { navigate, pending } = useProgressNav();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Daten auf EIN stabiles Promise<LoadState> normalisieren. Aufgelöste Eingaben
  // (Objekt) werden in ein bereits erfülltes Promise verpackt -> `use()` liefert
  // sofort, ohne Suspense-Fallback. useMemo hält die Referenz stabil, solange sich
  // `data` nicht ändert (sonst würde `use()` in einer Schleife neu suspendieren).
  const dataPromise = React.useMemo<Promise<LoadState>>(
    () => (isThenable(data) ? data : Promise.resolve({ ok: true, data })),
    [data],
  );

  const [searchValue, setSearchValue] = React.useState(
    searchParams.get("q") ?? "",
  );

  // Mehrfachauswahl: IDs der aktuellen Seite. Leert bei Seiten-/Filterwechsel,
  // erkannt am Wechsel der Daten-Referenz (die Seite reicht bei jedem Filterwechsel
  // ein neues Promise/Objekt herein). Render-Phase statt Effect (React-Muster für
  // „State aus vorherigem Render") – und OHNE die geladenen Zeilen anzufassen, damit
  // die Eltern-Komponente nicht auf die Daten warten muss.
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(
    () => new Set(),
  );
  const [prevData, setPrevData] = React.useState(data);
  if (data !== prevData) {
    setPrevData(data);
    setSelectedIds(new Set());
  }

  const selectableActive =
    selectable && resources != null && myResourceId != null;

  // Mitarbeiter-Filter (Team): wir merken uns die ABGEWÄHLTEN IDs, nicht die
  // ausgewählten. Das übersteht ein serverseitiges Nachladen (Status-/Suchwechsel)
  // unbeschadet – der Standard (alle außer Philipp König) bleibt erhalten, ohne dass
  // eine sich ändernde Optionsliste die Auswahl verwirft. Nicht zugewiesene Tickets
  // (und Tickets unbekannter Mitarbeiter) werden von diesem Filter NIE ausgeblendet.
  const defaultDeselected = React.useMemo(
    () => new Set(defaultDeselectedResourceIds ?? []),
    [defaultDeselectedResourceIds],
  );
  const [deselectedResources, setDeselectedResources] = React.useState<
    Set<number>
  >(() => new Set(defaultDeselectedResourceIds ?? []));

  // Gespeicherte Auswahl laden (erst im Effect -> kein Hydration-Mismatch). Nur wenn
  // der Mitarbeiter-Filter aktiv ist und tatsächlich etwas gespeichert wurde.
  /* eslint-disable react-hooks/set-state-in-effect -- bewusste, einmalige
     localStorage-Hydration nach Mount (SSR-sicher), kein Render-Footgun. */
  React.useEffect(() => {
    if (!resourceFilter) return;
    const saved = loadDeselectedResources();
    if (saved) setDeselectedResources(saved);
  }, [resourceFilter]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Brücke „abgewählt" -> „ausgewählt" (Sicht der Filter-Komponente). Persistenz
  // BEWUSST außerhalb des State-Updaters: React kann Updater spekulativ mehrfach/
  // verworfen aufrufen – Seiteneffekte gehören nicht hinein. `options` kommen aus der
  // (daten-gebundenen) Mitarbeiter-Filter-Insel zurück.
  const handleResourceChange = React.useCallback(
    (options: { id: number; name: string }[], nextSelected: Set<number>) => {
      setDeselectedResources((current) => {
        const next = new Set(current);
        for (const o of options) {
          if (nextSelected.has(o.id)) next.delete(o.id);
          else next.add(o.id);
        }
        persistDeselectedResources(next);
        return next;
      });
    },
    [],
  );

  // Server-Suche: bei geändertem Begriff (debounced) ?q= setzen; die Seite mischt
  // den Filter serverseitig ein. Nur wenn sich der Begriff vom URL-Stand unterscheidet.
  React.useEffect(() => {
    if (searchMode !== "server") return;
    const current = searchParams.get("q") ?? "";
    if (searchValue.trim() === current) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (searchValue.trim()) params.set("q", searchValue.trim());
      else params.delete("q");
      params.delete("cursor");
      navigate(`${pathname}?${params.toString()}`);
    }, 350);
    return () => clearTimeout(t);
  }, [searchValue, searchMode, searchParams, pathname, navigate]);

  function updateFilter(
    key: "status" | "priority" | "queue" | "assigned",
    value: string,
  ) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" || (key === "status" && value === "open")) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete("cursor"); // Filterwechsel setzt das Paging zurück.
    navigate(`${pathname}?${params.toString()}`);
  }

  const goToCursor = React.useCallback(
    (cursor: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("cursor", cursor);
      navigate(`${pathname}?${params.toString()}`);
    },
    [searchParams, pathname, navigate],
  );

  function toggleRow(id: number, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const statusItems = [
    { label: "Offene", value: "open" },
    { label: "Alle", value: "all" },
    ...picklists.status.map((s) => ({ label: s.label, value: String(s.value) })),
  ];
  const priorityItems = [
    { label: "Alle Prioritäten", value: "all" },
    ...picklists.priority.map((p) => ({ label: p.label, value: String(p.value) })),
  ];
  const queueItems = [
    { label: "Alle Queues", value: "all" },
    ...picklists.queue.map((q) => ({ label: q.label, value: String(q.value) })),
  ];
  const assignmentItems = [
    { label: "Alle Tickets", value: "all" },
    { label: "Nicht zugewiesene", value: "unassigned" },
  ];

  // Auswahl-Status OHNE die geladenen Zeilen: `selectedIds` wird bei jedem Daten-
  // wechsel geleert und nur über gerenderte (also vorhandene) Zeilen befüllt -> ist
  // garantiert eine Teilmenge der aktuellen Daten. So weiß die Toolbar, ob die Bulk-
  // Leiste zu zeigen ist, ohne auf das Daten-Promise zu warten.
  const hasSelection = selectableActive && selectedIds.size > 0;
  const showToolbar = searchMode !== "off" || showFilters;

  // Spalten als Defs (daten-unabhängig). Die Checkbox-Spalte bleibt fest vorne und
  // ist NICHT Teil der umsortierbaren Spalten.
  // Firma/Queue erst ab 2xl, damit die Kernspalten im xl-Band (Tabelle ab xl
  // sichtbar) ohne Horizontal-Scroll passen. "Zugewiesen" (Besitzer) schon ab xl,
  // damit die Teamliste im häufigen 1280–1535-Band zeigt, wem ein Ticket gehört.
  const hideSecondary = "hidden 2xl:table-cell";
  const hideAssignee = "hidden xl:table-cell";
  const dataColumns: ColumnDef[] = [
    {
      id: "number",
      header: "Nummer",
      sortValue: (t) => t.ticketNumber ?? "",
      cell: (t) => (
        <TableCell className="font-medium tabular-nums whitespace-nowrap">
          {t.ticketNumber}
        </TableCell>
      ),
    },
    {
      id: "title",
      header: "Titel",
      sortValue: (t) => t.title ?? "",
      cell: (t) => (
        <TableCell>
          <TruncatedText
            className={cn(
              "max-w-xs",
              compact
                ? "xl:max-w-[8rem] 2xl:max-w-[14rem]"
                : "xl:max-w-[12rem] 2xl:max-w-md",
            )}
          >
            {t.title ?? "—"}
          </TruncatedText>
        </TableCell>
      ),
    },
    ...(columns.company !== false
      ? [
          {
            id: "company",
            header: "Firma",
            headClass: hideSecondary,
            sortValue: (t: TicketRow) => t.companyName ?? "",
            cell: (t: TicketRow) => (
              <TableCell className={hideSecondary}>
                <TruncatedText className="max-w-44">
                  {t.companyName ?? "—"}
                </TruncatedText>
              </TableCell>
            ),
          },
        ]
      : []),
    ...(columns.queue
      ? [
          {
            id: "queue",
            header: "Queue",
            headClass: hideSecondary,
            sortValue: (t: TicketRow) => labelOf(picklists.queue, t.queueID),
            cell: (t: TicketRow) => (
              <TableCell className={hideSecondary}>
                <TruncatedText className="max-w-36">
                  {labelOf(picklists.queue, t.queueID)}
                </TruncatedText>
              </TableCell>
            ),
          },
        ]
      : []),
    ...(columns.assigned
      ? [
          {
            id: "assigned",
            header: "Zugewiesen",
            headClass: hideAssignee,
            sortValue: (t: TicketRow) => t.assignedResourceName ?? "",
            cell: (t: TicketRow) => (
              <TableCell className={hideAssignee}>
                <TruncatedText className="max-w-40">
                  {t.assignedResourceName ?? "—"}
                </TruncatedText>
              </TableCell>
            ),
          },
        ]
      : []),
    {
      id: "status",
      header: "Status",
      sortValue: (t) => t.status ?? null,
      cell: (t) => (
        <TableCell>
          <StatusBadge
            status={t.status}
            label={labelOf(picklists.status, t.status)}
          />
        </TableCell>
      ),
    },
    {
      id: "priority",
      header: "Priorität",
      sortValue: (t) => t.priority ?? null,
      cell: (t) => (
        <TableCell>
          <PriorityBadge
            priority={t.priority}
            label={labelOf(picklists.priority, t.priority)}
          />
        </TableCell>
      ),
    },
    {
      id: "created",
      header: "Erstellt",
      sortValue: (t) => dateSortValue(t.createDate),
      cell: (t) => (
        <TableCell className="text-muted-foreground tabular-nums whitespace-nowrap">
          {formatDate(t.createDate)}
        </TableCell>
      ),
    },
    {
      id: "due",
      header: "Fällig",
      sortValue: (t) => dateSortValue(t.dueDateTime),
      cell: (t) => (
        <TableCell
          className={cn(
            "tabular-nums whitespace-nowrap",
            isOverdue(t.dueDateTime) ? "text-warning" : "text-muted-foreground",
          )}
        >
          {formatDate(t.dueDateTime)}
        </TableCell>
      ),
    },
  ];
  const columnIds = dataColumns.map((c) => c.id);
  const {
    order: colOrder,
    headProps: colHeadProps,
    reset: colReset,
    customized: colCustomized,
  } = useColumnOrder(`cols:tickets:${columnIds.join("-")}`, columnIds);
  const colMap = Object.fromEntries(dataColumns.map((c) => [c.id, c]));
  const orderedCols = colOrder.map((id) => colMap[id]).filter(Boolean);

  // Mobile-Filterchips / Desktop-Selects: aktiver (nicht-Default-)Filter wird dezent
  // gefüllt hervorgehoben, inaktiv neutral/outline.
  const chipState = (active: boolean) =>
    active
      ? "border-transparent bg-secondary font-medium text-secondary-foreground"
      : "border-input text-foreground";
  const statusActive = (filters.status || "open") !== "open";
  const priorityActive = (filters.priority || "all") !== "all";
  const queueActive = (filters.queue || "all") !== "all";
  const assignedActive = (filters.assigned || "all") !== "all";

  return (
    <div className="flex flex-col gap-4">
      {/* Filterzeile und Bulk-Leiste teilen sich EINE Grid-Zelle (übereinander
          gestapelt). Die jeweils inaktive bleibt unsichtbar im Layout stehen ->
          die Slot-Höhe ist konstant, beim Markieren springt nichts.
          Ausnahme: Listen OHNE Toolbar (Dashboard-Übersicht) reservieren KEINEN
          leeren Slot – sonst klafft eine Lücke. Dort erscheint die Bulk-Leiste
          erst bei einer Auswahl.
          WICHTIG: Diese Toolbar rendert SOFORT aus props (picklists/filters) – sie
          hängt NICHT am Daten-Promise. So sind Suche + Filterchips beim Navigieren
          sofort da; nur die Tabelle darunter streamt (Suspense). */}
      {(showToolbar || (selectableActive && hasSelection)) && (
        // grid-cols-1 = minmax(0,1fr): deckelt die Spalte auf die Containerbreite,
        // sonst wüchse sie auf die max-content-Breite der scrollbaren Bulk-Leiste.
        <div className="grid grid-cols-1">
          {showToolbar && (
            <div
              className={cn(
                "col-start-1 row-start-1 flex flex-col gap-2 self-start",
                hasSelection && "invisible",
              )}
            >
              {searchMode !== "off" && (
                <SearchInput
                  value={searchValue}
                  onValueChange={setSearchValue}
                  placeholder="Nummer oder Titel suchen …"
                  aria-label="Tickets suchen"
                  containerClassName="sm:max-w-xs"
                />
              )}

              {showFilters && (
                <div
                  className={cn(
                    "grid w-full gap-2",
                    assignmentFilter ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3",
                  )}
                >
                  <Select
                    items={statusItems}
                    value={filters.status || "open"}
                    onValueChange={(v) => updateFilter("status", String(v))}
                  >
                    <SelectTrigger
                      size="sm"
                      className={cn("h-11 w-full min-w-0 sm:h-9", chipState(statusActive))}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="w-auto min-w-56">
                      <SelectGroup>
                        {statusItems.map((i) => (
                          <SelectItem key={i.value} value={i.value}>
                            {i.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>

                  <Select
                    items={priorityItems}
                    value={filters.priority || "all"}
                    onValueChange={(v) => updateFilter("priority", String(v))}
                  >
                    <SelectTrigger
                      size="sm"
                      className={cn("h-11 w-full min-w-0 sm:h-9", chipState(priorityActive))}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="w-auto min-w-44">
                      <SelectGroup>
                        {priorityItems.map((i) => (
                          <SelectItem key={i.value} value={i.value}>
                            {i.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>

                  {resourceFilter ? (
                    // Mitarbeiter-Filter: Optionen kommen aus den GELADENEN Tickets ->
                    // daten-gebunden, daher als eigene Suspense-Insel (Platzhalter-Chip,
                    // bis die Liste da ist). Die übrigen Chips bleiben sofort bedienbar.
                    <React.Suspense
                      fallback={
                        <Skeleton className="h-11 w-full rounded-md sm:h-9" />
                      }
                    >
                      <ResourceFilterCell
                        dataPromise={dataPromise}
                        deselectedResources={deselectedResources}
                        defaultDeselected={defaultDeselected}
                        onChange={handleResourceChange}
                      />
                    </React.Suspense>
                  ) : (
                    <Select
                      items={queueItems}
                      value={filters.queue || "all"}
                      onValueChange={(v) => updateFilter("queue", String(v))}
                    >
                      <SelectTrigger
                        size="sm"
                        className={cn("h-11 w-full min-w-0 sm:h-9", chipState(queueActive))}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="w-auto min-w-52">
                        <SelectGroup>
                          {queueItems.map((i) => (
                            <SelectItem key={i.value} value={i.value}>
                              {i.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}

                  {assignmentFilter && (
                    <Select
                      items={assignmentItems}
                      value={filters.assigned || "all"}
                      onValueChange={(v) => updateFilter("assigned", String(v))}
                    >
                      <SelectTrigger
                        size="sm"
                        className={cn("h-11 w-full min-w-0 sm:h-9", chipState(assignedActive))}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="w-auto min-w-64">
                        <SelectGroup>
                          {assignmentItems.map((i) => (
                            <SelectItem key={i.value} value={i.value}>
                              {i.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
              {colCustomized && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={colReset}
                  className="text-muted-foreground"
                >
                  <ArrowCounterClockwise />
                  Spalten zurücksetzen
                </Button>
              )}
            </div>
          )}
          {selectableActive && resources && myResourceId != null && (
            <div
              className={cn(
                "col-start-1 row-start-1 flex w-full",
                !hasSelection && "invisible",
              )}
            >
              {/* Bulk-Leiste braucht die Feldwerte der ausgewählten Zeilen (für Undo)
                  -> daten-gebunden. Erscheint ohnehin erst bei einer Auswahl, also
                  nachdem die Daten da sind (Suspense-Fallback = null). */}
              <React.Suspense fallback={null}>
                <BulkBarCell
                  dataPromise={dataPromise}
                  selectedIds={selectedIds}
                  picklists={picklists}
                  resources={resources}
                  myResourceId={myResourceId}
                  onClearSelection={() => setSelectedIds(new Set())}
                  onApplied={() => {
                    setSelectedIds(new Set());
                    onBulkApplied?.();
                  }}
                  fallbackRefresh={!onBulkApplied}
                />
              </React.Suspense>
            </div>
          )}
        </div>
      )}

      {/* Ergebnis beim Filter-/Such-/Seitenwechsel dezent abdimmen, solange der
          Server nachlädt – Toolbar/Filter bleiben bedienbar, nichts wirkt eingefroren
          (zusätzlich läuft der globale Ladebalken). Die Tabelle selbst hängt am
          Daten-Promise (Suspense): beim Erst-/Routenwechsel zeigt sie ein Tabellen-
          Skelett, während die Toolbar oben schon steht. */}
      <div
        className={cn(
          "flex flex-col gap-4 transition-opacity",
          pending && "pointer-events-none opacity-60",
        )}
      >
        <React.Suspense
          fallback={
            <TableSkeleton
              columns={dataColumns.length}
              rows={8}
              withCheckbox={selectableActive}
              breakpoint="xl"
              minWidthClass={compact ? "min-w-3xl" : "min-w-2xl"}
            />
          }
        >
          <ResultsCell
            dataPromise={dataPromise}
            picklists={picklists}
            orderedCols={orderedCols}
            colHeadProps={colHeadProps}
            dataColumns={dataColumns}
            searchValue={searchValue}
            searchMode={searchMode}
            resourceFilter={resourceFilter}
            deselectedResources={deselectedResources}
            selectableActive={selectableActive}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            toggleRow={toggleRow}
            columns={columns}
            compact={compact}
            bordered={bordered}
            mobileLimit={mobileLimit}
            mobileOverflowHint={mobileOverflowHint}
            showPager={showPager}
            goToCursor={goToCursor}
            emptyDescription={emptyDescription}
          />
        </React.Suspense>
      </div>
    </div>
  );
}

// Mitarbeiter-Filter-Insel: liest die geladenen Tickets (use), leitet die im Ergebnis
// vorkommenden Bearbeiter ab und rendert den Filter. Eigene Komponente, damit NUR
// dieser Chip auf die Daten wartet – die übrigen Chips stehen sofort.
function ResourceFilterCell({
  dataPromise,
  deselectedResources,
  defaultDeselected,
  onChange,
}: {
  dataPromise: Promise<LoadState>;
  deselectedResources: Set<number>;
  defaultDeselected: Set<number>;
  onChange: (
    options: { id: number; name: string }[],
    nextSelected: Set<number>,
  ) => void;
}) {
  const state = React.use(dataPromise);

  const options = React.useMemo(() => {
    const items = state.ok ? state.data.items : [];
    const map = new Map<number, string>();
    for (const t of items) {
      if (t.assignedResourceID != null && t.assignedResourceName) {
        map.set(t.assignedResourceID, t.assignedResourceName);
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [state]);

  if (options.length === 0) {
    // Keine ableitbaren Bearbeiter -> Platzhalter-Chip (hält die Grid-Spalte).
    return <Skeleton className="h-11 w-full rounded-md opacity-0 sm:h-9" />;
  }

  const selected = new Set(
    options.filter((o) => !deselectedResources.has(o.id)).map((o) => o.id),
  );

  return (
    <ResourceFilter
      options={options}
      selected={selected}
      onChange={(next) => onChange(options, next)}
      active={!setsEqual(deselectedResources, defaultDeselected)}
    />
  );
}

// Bulk-Leisten-Insel: schnappschusst die Feldwerte der ausgewählten Zeilen aus den
// geladenen Tickets (für Undo) und rendert die Bulk-Leiste.
function BulkBarCell({
  dataPromise,
  selectedIds,
  picklists,
  resources,
  myResourceId,
  onClearSelection,
  onApplied,
  fallbackRefresh,
}: {
  dataPromise: Promise<LoadState>;
  selectedIds: Set<number>;
  picklists: TicketPicklists;
  resources: ResourceOption[];
  myResourceId: number;
  onClearSelection: () => void;
  onApplied: () => void;
  // true -> kein onBulkApplied übergeben: serverseitige Liste per router.refresh()
  // aktualisieren. false -> der Aufrufer lädt selbst nach (onApplied).
  fallbackRefresh: boolean;
}) {
  const router = useRouter();
  const state = React.use(dataPromise);
  const items = state.ok ? state.data.items : [];

  const selectedTickets = items
    .filter((t) => selectedIds.has(t.id))
    .map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber ?? String(t.id),
      status: t.status,
      priority: t.priority,
      queueID: t.queueID,
      assignedResourceID: t.assignedResourceID,
      assignedResourceRoleID: t.assignedResourceRoleID,
      companyID: t.companyID,
      title: t.title ?? null,
    }));

  if (selectedTickets.length === 0) return null;

  return (
    <BulkBar
      selected={selectedTickets}
      picklists={picklists}
      resources={resources}
      myResourceId={myResourceId}
      onClearSelection={onClearSelection}
      onApplied={() => {
        onApplied();
        if (fallbackRefresh) router.refresh();
      }}
    />
  );
}

// Ergebnis-Insel: löst das Daten-Promise auf und rendert Tabelle/Karten/Pager bzw.
// Leerzustand/Fehler. Alles Daten-GEBUNDENE lebt hier; die Toolbar oben bleibt davon
// unberührt (rendert sofort).
function ResultsCell({
  dataPromise,
  picklists,
  orderedCols,
  colHeadProps,
  dataColumns,
  searchValue,
  searchMode,
  resourceFilter,
  deselectedResources,
  selectableActive,
  selectedIds,
  setSelectedIds,
  toggleRow,
  columns,
  compact,
  bordered,
  mobileLimit,
  mobileOverflowHint,
  showPager,
  goToCursor,
  emptyDescription,
}: {
  dataPromise: Promise<LoadState>;
  picklists: TicketPicklists;
  orderedCols: ColumnDef[];
  colHeadProps: (id: string) => React.HTMLAttributes<HTMLElement>;
  dataColumns: ColumnDef[];
  searchValue: string;
  searchMode: SearchMode;
  resourceFilter: boolean;
  deselectedResources: Set<number>;
  selectableActive: boolean;
  selectedIds: Set<number>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  toggleRow: (id: number, checked: boolean) => void;
  columns: { queue?: boolean; assigned?: boolean; company?: boolean };
  compact: boolean;
  bordered: boolean;
  mobileLimit?: number;
  mobileOverflowHint: boolean;
  showPager: boolean;
  goToCursor: (cursor: string) => void;
  emptyDescription: string;
}) {
  const { openTicket } = useRecordNav();
  const state = React.use(dataPromise);

  // Klick-zum-Sortieren der Desktop-Tabelle (nur Tabelle; die mobile Kartenliste
  // behält die Server-Reihenfolge). Hooks vor dem frühen Return halten.
  const {
    toggle: toggleSort,
    sortRows,
    isSortable,
    ariaSort,
    sort,
  } = useTableSort(dataColumns.map((c) => ({ key: c.id, sortValue: c.sortValue })));

  if (!state.ok) {
    return (
      <DataError
        title="Tickets konnten nicht geladen werden"
        rateLimited={state.rateLimited}
      />
    );
  }
  const data = state.data;

  // Sofort-Clientfilter (Nummer/Titel) der geladenen Zeilen.
  const term = searchValue.trim().toLowerCase();
  const searched = term
    ? data.items.filter(
        (t) =>
          (t.ticketNumber ?? "").toLowerCase().includes(term) ||
          (t.title ?? "").toLowerCase().includes(term),
      )
    : data.items;
  // Mitarbeiter-Filter (Team): nur zugewiesene Tickets mit abgewähltem Bearbeiter
  // fallen raus. Nicht zugewiesene bleiben immer sichtbar.
  const resourceFilterApplied = resourceFilter && deselectedResources.size > 0;
  const items = resourceFilterApplied
    ? searched.filter(
        (t) =>
          t.assignedResourceID == null ||
          !deselectedResources.has(t.assignedResourceID),
      )
    : searched;

  // Paging ausblenden, wenn ein Clientfilter aktiv ist (Cursor bezieht sich auf den
  // ungefilterten Serverstand).
  const pagerVisible = showPager && !(term && searchMode === "client");

  const visibleIds = items.map((t) => t.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  function toggleAll(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of visibleIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  const tableItems = sortRows(items);

  if (items.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TicketIcon />
          </EmptyMedia>
          <EmptyTitle>Keine Tickets</EmptyTitle>
          <EmptyDescription>
            {term ? "Keine Treffer für die Suche." : emptyDescription}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      {/* Mobile-First: unter xl je Ticket eine Karte (kein Querscrollen). Ab xl die
          volle Tabelle mit umsortierbaren Spalten. Die Karte ist die gemeinsame
          TicketCard (Variante "worklist" → "Fällig …"). */}
      <div
        className={cn(
          "xl:hidden",
          bordered ? "grid grid-cols-1 gap-2" : "divide-y",
        )}
      >
        {(mobileLimit ? items.slice(0, mobileLimit) : items).map((t) => (
          <TicketCard
            key={t.id}
            ticket={t}
            picklists={picklists}
            variant="worklist"
            columns={columns}
            selectable={selectableActive}
            selected={selectedIds.has(t.id)}
            onToggleSelect={(c) => toggleRow(t.id, c)}
            flat={!bordered}
          />
        ))}
      </div>
      {mobileOverflowHint && mobileLimit && items.length > mobileLimit && (
        <p className="text-muted-foreground text-center text-xs xl:hidden">
          + {items.length - mobileLimit} weitere …
        </p>
      )}

      <div
        className={cn(
          "hidden overflow-x-auto xl:block",
          bordered && "rounded-lg border",
        )}
      >
        <Table className={cn(!compact && "min-w-2xl")}>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {selectableActive && (
                <TableHead className="w-px">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={(c) => toggleAll(c === true)}
                    aria-label="Alle auf dieser Seite auswählen"
                  />
                </TableHead>
              )}
              {orderedCols.map((c) => {
                const sortable = isSortable(c.id);
                const state2 = sort?.key === c.id ? sort.dir : ("none" as const);
                return (
                  <TableHead
                    key={c.id}
                    aria-sort={ariaSort(c.id)}
                    className={cn(
                      "group/sorthead data-[dragover]:bg-accent data-[dragging]:opacity-60 cursor-grab transition-colors select-none active:cursor-grabbing",
                      sortable && "cursor-pointer",
                      c.headClass,
                    )}
                    title={
                      sortable
                        ? "Klicken zum Sortieren · ziehen zum Verschieben"
                        : "Spalte ziehen, um die Reihenfolge zu ändern"
                    }
                    {...colHeadProps(c.id)}
                    onClick={sortable ? () => toggleSort(c.id) : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.header}
                      {sortable && <SortIcon state={state2} />}
                    </span>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableItems.map((t) => (
              <TableRow
                key={t.id}
                className="cursor-pointer"
                onClick={() => openTicket(t.id)}
              >
                {selectableActive && (
                  <TableCell
                    className="w-px"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={selectedIds.has(t.id)}
                      onCheckedChange={(c) => toggleRow(t.id, c === true)}
                      aria-label={`Ticket ${t.ticketNumber} auswählen`}
                    />
                  </TableCell>
                )}
                {orderedCols.map((c) => (
                  <React.Fragment key={c.id}>{c.cell(t)}</React.Fragment>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data.capped && (
        <p className="text-muted-foreground text-xs">
          Sehr viele Tickets – es werden die ersten {data.total} angezeigt.
        </p>
      )}

      {pagerVisible && (
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            className="h-11 flex-1 sm:h-9 sm:flex-none"
            disabled={!data.prevCursor}
            onClick={() => data.prevCursor && goToCursor(data.prevCursor)}
          >
            Zurück
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-11 flex-1 sm:h-9 sm:flex-none"
            disabled={!data.nextCursor}
            onClick={() => data.nextCursor && goToCursor(data.nextCursor)}
          >
            Weiter
          </Button>
        </div>
      )}
    </>
  );
}
