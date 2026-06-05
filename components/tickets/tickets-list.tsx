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
import { Badge } from "@/components/ui/badge";
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
import {
  labelOf,
  statusVariant,
  priorityVariant,
} from "@/lib/autotask/mappers";
import type { Ticket, TicketPicklists } from "@/lib/autotask/types";
import type { ResourceOption } from "@/lib/autotask/entities/resources";
import { openTicketPopup } from "@/lib/open-popup";

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
  showFilters?: boolean; // Fokuslisten (Dashboard) blenden die Filterleiste aus
  showPager?: boolean; // und das Paging
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

export function TicketsList({
  data,
  picklists,
  filters,
  columns = {},
  assignmentFilter = false,
  showFilters = true,
  showPager = true,
  searchMode = "server",
  emptyDescription = "Für die aktuelle Auswahl gibt es keine Tickets.",
  selectable = false,
  resources,
  myResourceId,
}: Props) {
  const router = useRouter();
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
  const pageKey = data.items.map((t) => t.id).join(",");
  React.useEffect(() => {
    setSelectedIds(new Set());
  }, [pageKey]);

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
  const items = term
    ? data.items.filter(
        (t) =>
          (t.ticketNumber ?? "").toLowerCase().includes(term) ||
          (t.title ?? "").toLowerCase().includes(term),
      )
    : data.items;

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
    { label: "Alle (auch nicht zugewiesene)", value: "all" },
    { label: "Nur nicht zugewiesene", value: "unassigned" },
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
  const dataColumns: {
    id: string;
    header: string;
    cell: (t: TicketRow) => React.ReactNode;
  }[] = [
    {
      id: "number",
      header: "Nummer",
      cell: (t) => (
        <TableCell className="font-medium tabular-nums whitespace-nowrap">
          {t.ticketNumber}
        </TableCell>
      ),
    },
    {
      id: "title",
      header: "Titel",
      cell: (t) => (
        <TableCell>
          <TruncatedText className="max-w-md">{t.title ?? "—"}</TruncatedText>
        </TableCell>
      ),
    },
    ...(columns.company !== false
      ? [
          {
            id: "company",
            header: "Firma",
            cell: (t: TicketRow) => (
              <TableCell>
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
            cell: (t: TicketRow) => (
              <TableCell>
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
            cell: (t: TicketRow) => (
              <TableCell>
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
      cell: (t) => (
        <TableCell>
          <Badge variant={statusVariant(t.status)}>
            {labelOf(picklists.status, t.status)}
          </Badge>
        </TableCell>
      ),
    },
    {
      id: "priority",
      header: "Priorität",
      cell: (t) => (
        <TableCell>
          <Badge variant={priorityVariant(t.priority)}>
            {labelOf(picklists.priority, t.priority)}
          </Badge>
        </TableCell>
      ),
    },
    {
      id: "due",
      header: "Fällig",
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

  return (
    <div className="flex flex-col gap-4">
      {/* Filterzeile und Bulk-Leiste teilen sich EINE Grid-Zelle (übereinander
          gestapelt). Die jeweils inaktive bleibt unsichtbar im Layout stehen ->
          die Slot-Höhe ist konstant, beim Markieren springt nichts. */}
      {(showToolbar || selectableActive) && (
        <div className="grid">
          {showToolbar && (
            <div
              className={cn(
                "col-start-1 row-start-1 flex flex-wrap items-center gap-2",
                hasSelection && "invisible",
              )}
            >
          {searchMode !== "off" && (
            <div className="relative w-full min-w-48 flex-1 sm:max-w-xs">
              <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Nummer oder Titel suchen …"
                className="pl-9"
                aria-label="Tickets suchen"
              />
            </div>
          )}

          {showFilters && (
            <>
              <Select
                items={statusItems}
                value={filters.status || "open"}
                onValueChange={(v) => updateFilter("status", String(v))}
              >
                <SelectTrigger size="sm" className="w-auto min-w-40">
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
                <SelectTrigger size="sm" className="w-auto min-w-44">
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

              <Select
                items={queueItems}
                value={filters.queue || "all"}
                onValueChange={(v) => updateFilter("queue", String(v))}
              >
                <SelectTrigger size="sm" className="w-auto min-w-48">
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

              {assignmentFilter && (
                <Select
                  items={assignmentItems}
                  value={filters.assigned || "all"}
                  onValueChange={(v) => updateFilter("assigned", String(v))}
                >
                  <SelectTrigger size="sm" className="w-auto min-w-56">
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
            </>
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
          <div className="overflow-x-auto rounded-lg border">
            <Table className="min-w-3xl">
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
                  {orderedCols.map((c) => (
                    <TableHead
                      key={c.id}
                      className="data-[dragover]:bg-accent data-[dragging]:opacity-60 cursor-grab transition-colors select-none active:cursor-grabbing"
                      title="Spalte ziehen, um die Reihenfolge zu ändern"
                      {...colHeadProps(c.id)}
                    >
                      {c.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((t) => (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer"
                    onClick={() => openTicketPopup(t.id)}
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
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!data.prevCursor}
                onClick={() => data.prevCursor && goToCursor(data.prevCursor)}
              >
                Zurück
              </Button>
              <Button
                variant="outline"
                size="sm"
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
