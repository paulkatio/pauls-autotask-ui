"use client";

import * as React from "react";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronsUpDownIcon,
  ContactIcon,
  RotateCcwIcon,
  SearchIcon,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { TruncatedText } from "@/components/truncated-text";
import { useColumnOrder } from "@/hooks/use-column-order";
import { openContactModal } from "@/lib/open-contact";
import type { ContactListRow } from "@/lib/autotask/entities/contact-list";

type SortKey = "name" | "companyName" | "email" | "phone";
type SortDir = "asc" | "desc";
type CompanyFilter = { id: number; name: string } | null;

// Kontaktliste (B4 + Paul-Feedback): erste Seite vom Server, beim Tippen
// serverseitige contains-Suche (debounced) auf Vor-/Nachname, optional auf eine
// Firma eingegrenzt (Firma-Combobox, async). Sortierung clientseitig; Zeilenklick
// öffnet das kompakte Kontakt-Overlay (gleiches Fenster).
export function ContactsTable({ initial }: { initial: ContactListRow[] }) {
  const [q, setQ] = React.useState("");
  const [company, setCompany] = React.useState<CompanyFilter>(null);
  const [rows, setRows] = React.useState<ContactListRow[]>(initial);
  const [loading, setLoading] = React.useState(false);
  const [sortKey, setSortKey] = React.useState<SortKey>("name");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");

  // Kontakte laden: erste Seite (ohne Filter) oder server-gefiltert nach Name/Firma.
  /* eslint-disable react-hooks/set-state-in-effect -- bewusster, korrekter Effekt
     (debounced Server-Suche): synchrones Zurücksetzen/Loading ist gewollt. */
  React.useEffect(() => {
    const term = q.trim();
    if (!term && !company) {
      setRows(initial);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const params = new URLSearchParams();
      if (term) params.set("q", term);
      if (company) params.set("companyId", String(company.id));
      try {
        const res = await fetch(`/api/contacts/search?${params.toString()}`, {
          cache: "no-store",
        });
        const j = (await res.json().catch(() => ({}))) as {
          contacts?: ContactListRow[];
        };
        if (active) setRows(j.contacts ?? []);
      } catch {
        if (active) setRows([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q, company, initial]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = React.useMemo(() => {
    return [...rows].sort((a, b) => {
      const cmp = String(a[sortKey] ?? "").localeCompare(
        String(b[sortKey] ?? ""),
        "de",
      );
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  function SortHead({
    label,
    col,
    dragProps,
  }: {
    label: string;
    col: SortKey;
    dragProps: React.HTMLAttributes<HTMLElement> & { draggable: boolean };
  }) {
    const active = sortKey === col;
    const Icon = !active
      ? ArrowUpDownIcon
      : sortDir === "asc"
        ? ArrowUpIcon
        : ArrowDownIcon;
    return (
      <TableHead
        className="data-[dragover]:bg-accent data-[dragging]:opacity-60 cursor-grab transition-colors active:cursor-grabbing"
        title="Spalte ziehen, um die Reihenfolge zu ändern"
        {...dragProps}
      >
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 h-8"
          onClick={() => toggleSort(col)}
          aria-label={`Nach ${label} sortieren`}
        >
          <span className={active ? "text-foreground" : undefined}>{label}</span>
          <Icon className="text-muted-foreground" />
        </Button>
      </TableHead>
    );
  }

  const columnDefs: {
    id: string;
    label: string;
    sortKey: SortKey;
    cellClassName?: string;
    cell: (c: ContactListRow) => React.ReactNode;
  }[] = [
    {
      id: "name",
      label: "Name",
      sortKey: "name",
      cell: (c) => (
        <TruncatedText className="max-w-xs font-medium">{c.name}</TruncatedText>
      ),
    },
    {
      id: "company",
      label: "Firma",
      sortKey: "companyName",
      cellClassName: "text-muted-foreground",
      cell: (c) => (
        <TruncatedText className="max-w-44">{c.companyName ?? "—"}</TruncatedText>
      ),
    },
    {
      id: "email",
      label: "E-Mail",
      sortKey: "email",
      cellClassName: "text-muted-foreground",
      cell: (c) => (
        <TruncatedText className="max-w-48 2xl:max-w-xs">{c.email || "—"}</TruncatedText>
      ),
    },
    {
      id: "phone",
      label: "Telefon",
      sortKey: "phone",
      cellClassName: "text-muted-foreground tabular-nums whitespace-nowrap",
      cell: (c) => c.phone || "—",
    },
  ];
  const { order, headProps, reset, customized } = useColumnOrder(
    "cols:contacts",
    columnDefs.map((c) => c.id),
  );
  const colMap = Object.fromEntries(columnDefs.map((c) => [c.id, c]));
  const orderedCols = order.map((id) => colMap[id]).filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full min-w-48 flex-1 sm:max-w-xs">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Vor- oder Nachname suchen …"
            className="h-11 pl-9 sm:h-9"
            aria-label="Kontakte suchen"
          />
        </div>
        <CompanyFilterPicker company={company} onChange={setCompany} />
        <span className="text-muted-foreground w-full text-sm whitespace-nowrap sm:ml-auto sm:w-auto">
          {loading ? "Suchen …" : `${sorted.length} Kontakte`}
        </span>
        {customized && (
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            className="text-muted-foreground"
          >
            <RotateCcwIcon />
            Spalten zurücksetzen
          </Button>
        )}
      </div>

      {sorted.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ContactIcon />
            </EmptyMedia>
            <EmptyTitle>Keine Kontakte</EmptyTitle>
            <EmptyDescription>
              {q.trim() || company
                ? "Kein Kontakt passt zu Filter/Suche."
                : "Es sind keine aktiven Kontakte vorhanden."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
        {/* Mobile/Tablet: bis xl je Kontakt eine Karte (Tabelle würde sonst bis ~1280
            rechts klippen). */}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:hidden">
          {sorted.map((c) => (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => openContactModal(c.id)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openContactModal(c.id);
                }
              }}
              className="hover:bg-muted/50 active:bg-muted flex flex-col gap-1.5 rounded-lg border p-3 transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="text-sm font-medium break-words">{c.name}</span>
              {c.companyName && (
                <span className="text-muted-foreground text-xs">{c.companyName}</span>
              )}
              {c.email && (
                <span className="text-muted-foreground text-xs break-all">
                  {c.email}
                </span>
              )}
              {c.phone && (
                <span className="text-muted-foreground text-xs tabular-nums">
                  {c.phone}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto rounded-lg border xl:block">
          <Table className="min-w-2xl">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {orderedCols.map((col) => (
                  <SortHead
                    key={col.id}
                    label={col.label}
                    col={col.sortKey}
                    dragProps={headProps(col.id)}
                  />
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => openContactModal(c.id)}
                >
                  {orderedCols.map((col) => (
                    <TableCell key={col.id} className={col.cellClassName}>
                      {col.cell(c)}
                    </TableCell>
                  ))}
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

// Firma-Filter: async Firmensuche (wie im Neues-Ticket-Dialog) + „Alle Firmen".
function CompanyFilterPicker({
  company,
  onChange,
}: {
  company: CompanyFilter;
  onChange: (c: CompanyFilter) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<{ id: number; name: string }[]>(
    [],
  );
  const [loading, setLoading] = React.useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- bewusster, korrekter Effekt
     (debounced Server-Suche): synchrones Zurücksetzen/Loading ist gewollt. */
  React.useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/companies?q=${encodeURIComponent(term)}`, {
          cache: "no-store",
        });
        const j = (await res.json().catch(() => ({}))) as {
          companies?: { id: number; name: string }[];
        };
        if (active) setResults(j.companies ?? []);
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q, open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-11 w-full justify-between font-normal sm:h-9 sm:w-56"
            aria-label="Nach Firma filtern"
          />
        }
      >
        <span className="truncate">{company ? company.name : "Alle Firmen"}</span>
        <ChevronsUpDownIcon className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) p-0">
        <Command shouldFilter={false}>
          <CommandInput
            value={q}
            onValueChange={setQ}
            placeholder="Firmenname eingeben …"
          />
          <CommandList>
            {loading ? (
              <div className="text-muted-foreground p-3 text-sm">Suchen …</div>
            ) : (
              <CommandEmpty>
                {q.trim() ? "Keine Treffer." : "Firmenname eingeben."}
              </CommandEmpty>
            )}
            <CommandGroup>
              <CommandItem
                value="__all__"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                  setQ("");
                }}
              >
                Alle Firmen
              </CommandItem>
              {results.map((c) => (
                <CommandItem
                  key={c.id}
                  value={String(c.id)}
                  onSelect={() => {
                    onChange({ id: c.id, name: c.name });
                    setOpen(false);
                    setQ("");
                  }}
                >
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
