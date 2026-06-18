"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SearchIcon, TicketIcon } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { BulkBar } from "@/components/tickets/bulk-bar";
import { TruncatedText } from "@/components/truncated-text";
import { useColumnOrder } from "@/hooks/use-column-order";
import { RotateCcwIcon } from "lucide-react";
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

interface Props {
  data: { items: TicketRow[]; nextCursor: string | null; prevCursor: string | null };
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
}: Props) {
  const router = useRouter();
  const { openTicket } = useRecordNav();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchValue, setSearchValue] = React.useState(
    searchParams.get("q") ?? "",
  );

  // Mehrfachauswahl: IDs der aktuellen Seite. Leert bei Seiten-/Filterwechsel,
  // erkannt am Wechsel der geladenen Zeilen (data.items ändert sich serverseitig).
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(
    () => new Set(),
  );
  // Bei Seiten-/Filterwechsel die Auswahl leeren – während des Renders statt im
  // Effect (React-Muster für „State aus vorherigem Render").
  const pageKey = data.items.map((t) => t.id).join(",");
  const [prevPageKey, setPrevPageKey] = React.useState(pageKey);
  if (pageKey !== prevPageKey) {
    setPrevPageKey(pageKey);
    setSelectedIds(new Set());
  }

  function toggleRow(id: number, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
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

  // Auswählbare Mitarbeiter = die in der geladenen Liste tatsächlich vorkommenden
  // Bearbeiter (dedupliziert, alphabetisch). So listet der Filter nur relevante Namen.
  const resourceOptions = React.useMemo(() => {
    if (!resourceFilter) return [];
    const map = new Map<number, string>();
    for (const t of data.items) {
      if (t.assignedResourceID != null && t.assignedResourceName) {
        map.set(t.assignedResourceID, t.assignedResourceName);
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [resourceFilter, data.items]);

  // Brücke zwischen „abgewählt" (interner Zustand) und „ausgewählt" (Sicht der
  // Filter-Komponente über die aktuell sichtbaren Optionen).
  const selectedResourceIds = new Set(
    resourceOptions.filter((o) => !deselectedResources.has(o.id)).map((o) => o.id),
  );
  function handleResourceChange(nextSelected: Set<number>) {
    // Aus dem aktuellen Render-Wert ableiten (Event-Handler -> frischer Closure-Wert).
    // Persistenz BEWUSST außerhalb des State-Updaters: React kann Updater spekulativ
    // mehrfach/verworfen aufrufen – Seiteneffekte gehören nicht hinein.
    const next = new Set(deselectedResources);
    for (const o of resourceOptions) {
      if (nextSelected.has(o.id)) next.delete(o.id);
      else next.add(o.id);
    }
    setDeselectedResources(next);
    persistDeselectedResources(next);
  }
  const resourceFilterApplied =
    resourceFilter && resourceOptions.length > 0;

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
      router.push(`${pathname}?${params.toString()}`);
    }, 350);
    return () => clearTimeout(t);
  }, [searchValue, searchMode, searchParams, pathname, router]);

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
    router.push(`${pathname}?${params.toString()}`);
  }

  function goToCursor(cursor: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("cursor", cursor);
    router.push(`${pathname}?${params.toString()}`);
  }

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
  const items = resourceFilterApplied
    ? searched.filter(
        (t) =>
          t.assignedResourceID == null ||
          !deselectedResources.has(t.assignedResourceID),
      )
    : searched;

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

  // Paging ausblenden, wenn ein Clientfilter aktiv ist (Cursor bezieht sich auf den
  // ungefilterten Serverstand).
  const pagerVisible =
    showPager && !(term && searchMode === "client");

  // Auswahl der aktuell sichtbaren Zeilen (Kopf-Checkbox + Bulk-Leiste).
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
  // Auswahl inkl. aktueller Feldwerte – die Bulk-Leiste schnappschusst sie vor der
  // Aktion, damit sie sich rückgängig machen lässt (Undo).
  const selectedTickets = data.items
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
  const hasSelection = selectableActive && selectedTickets.length > 0;
  const showToolbar = searchMode !== "off" || showFilters;

  // Spalten als Defs (für Drag-&-Drop-Reihenfolge). Die Checkbox-Spalte bleibt
  // fest vorne und ist NICHT Teil der umsortierbaren Spalten.
  // Firma/Queue erst ab 2xl, damit die Kernspalten im xl-Band (Tabelle ab xl
  // sichtbar) ohne Horizontal-Scroll passen. "Zugewiesen" (Besitzer) schon ab xl,
  // damit die Teamliste im häufigen 1280–1535-Band zeigt, wem ein Ticket gehört.
  const hideSecondary = "hidden 2xl:table-cell";
  const hideAssignee = "hidden xl:table-cell";
  const dataColumns: {
    id: string;
    header: string;
    cell: (t: TicketRow) => React.ReactNode;
    headClass?: string;
    sortValue?: (t: TicketRow) => SortValue;
  }[] = [
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
          <TruncatedText className="max-w-xs xl:max-w-[12rem] 2xl:max-w-md">
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
        <TableCell className="text-muted-foreground tabular-nums whitespace-nowrap">
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

  // Klick-zum-Sortieren der Desktop-Tabelle. Sortiert nur die Tabelle (die mobile
  // Kartenliste behält die Server-Reihenfolge – dort gibt es keine Spaltenköpfe).
  const {
    toggle: toggleSort,
    sortRows,
    isSortable,
    ariaSort,
    sort,
  } = useTableSort(
    dataColumns.map((c) => ({ key: c.id, sortValue: c.sortValue })),
  );
  const tableItems = sortRows(items);

  // Mobile-Filterchips (Pillen, horizontal scrollbar). Aktiver = nicht-Default-Filter
  // wird gefüllt hervorgehoben, inaktiv neutral/outline. Ab sm normaler Select-Look
  // (Desktop unverändert).
  // Mobil füllen die Chips zu gleichen Teilen die volle Zeilenbreite (= Suchleiste).
  // 3 Chips → 1×3 (je ein Drittel, `flex-1`). 4 Chips (mit Zuweisungsfilter) →
  // 2×2-Raster (je halbe Breite, umbrechend), sonst werden sie abgeschnitten.
  // Ab sm wieder inhaltsbreite Chips (`flex-none`).
  // Filter-Selects liegen jetzt in einem gleichmaessigen Grid (2 Spalten mobil,
  // 3 bzw. 4 Spalten ab sm) statt frei umbrechender Pills -> einheitliche Groesse
  // auf jeder Breite. chipState faerbt aktive (nicht-Default-)Filter dezent ein.
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
          die Slot-Höhe ist konstant, beim Markieren springt nichts. */}
      {(showToolbar || selectableActive) && (
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
            <div className="relative w-full sm:max-w-xs">
              <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Nummer oder Titel suchen …"
                className="h-11 pl-9 sm:h-9"
                aria-label="Tickets suchen"
              />
            </div>
          )}

          {showFilters && (
            <div
              className={cn(
                "grid w-full gap-2",
                assignmentFilter
                  ? "grid-cols-2 sm:grid-cols-4"
                  : "grid-cols-3",
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
                <ResourceFilter
                  options={resourceOptions}
                  selected={selectedResourceIds}
                  onChange={handleResourceChange}
                  active={!setsEqual(deselectedResources, defaultDeselected)}
                />
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
                  <RotateCcwIcon />
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
              <BulkBar
                selected={selectedTickets}
                picklists={picklists}
                resources={resources}
                myResourceId={myResourceId}
                onClearSelection={() => setSelectedIds(new Set())}
                onApplied={() => {
                  setSelectedIds(new Set());
                  router.refresh();
                }}
              />
            </div>
          )}
        </div>
      )}

      {items.length === 0 ? (
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
      ) : (
        <>
          {/* Mobile-First: unter xl je Ticket eine Karte (kein Querscrollen). Ab xl
              die volle Tabelle mit umsortierbaren Spalten. Die Karte ist die
              gemeinsame TicketCard (Variante "worklist" → "Fällig …"). */}
          <div className="grid grid-cols-1 gap-2 xl:hidden">
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
              />
            ))}
          </div>
          {mobileOverflowHint && mobileLimit && items.length > mobileLimit && (
            <p className="text-muted-foreground text-center text-xs xl:hidden">
              + {items.length - mobileLimit} weitere …
            </p>
          )}

          <div className="hidden overflow-x-auto rounded-lg border xl:block">
            <Table className="min-w-2xl">
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
                    const state =
                      sort?.key === c.id ? sort.dir : ("none" as const);
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
                          {sortable && <SortIcon state={state} />}
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

          {pagerVisible && (
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <Button
                variant="outline"
                size="sm"
                className="h-11 flex-1 sm:h-7 sm:flex-none"
                disabled={!data.prevCursor}
                onClick={() => data.prevCursor && goToCursor(data.prevCursor)}
              >
                Zurück
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-11 flex-1 sm:h-7 sm:flex-none"
                disabled={!data.nextCursor}
                onClick={() => data.nextCursor && goToCursor(data.nextCursor)}
              >
                Weiter
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
