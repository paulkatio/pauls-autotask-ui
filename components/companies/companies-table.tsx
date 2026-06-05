"use client";

import * as React from "react";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  Building2Icon,
  RotateCcwIcon,
  SearchIcon,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { TruncatedText } from "@/components/truncated-text";
import { useColumnOrder } from "@/hooks/use-column-order";
import {
  companyTypeLabel,
  COMPANY_TYPE_CUSTOMER,
  COMPANY_TYPE_ORDER,
} from "@/lib/autotask/company-types";
import type { CompanyRow } from "@/lib/autotask/entities/company-list";
import { openCompanyPopup } from "@/lib/open-popup";

type SortKey = "name" | "city" | "companyType" | "phone" | "openTickets";
type SortDir = "asc" | "desc";

// Firmenliste (B2 + Paul-Feedback): Tippen-Filter, Kundenart-Filter (Default „Kunde"),
// clientseitige Sortierung über die Spaltenköpfe (Server sortiert nicht, B13). Zeilen-
// klick führt in die Kundenakte.
export function CompaniesTable({
  rows,
  companiesCapped,
  openCapped,
}: {
  rows: CompanyRow[];
  companiesCapped: boolean;
  openCapped: boolean;
}) {
  const [q, setQ] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState(
    String(COMPANY_TYPE_CUSTOMER),
  );
  const [sortKey, setSortKey] = React.useState<SortKey>("name");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "openTickets" ? "desc" : "asc");
    }
  }

  const typeItems = [
    { value: "all", label: "Alle Arten" },
    ...COMPANY_TYPE_ORDER.map((t) => ({
      value: String(t),
      label: companyTypeLabel(t),
    })),
  ];

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = rows.filter((r) => {
      if (typeFilter !== "all" && r.companyType !== Number(typeFilter)) {
        return false;
      }
      if (
        term &&
        !r.name.toLowerCase().includes(term) &&
        !r.city.toLowerCase().includes(term)
      ) {
        return false;
      }
      return true;
    });
    return [...base].sort((a, b) => {
      let cmp: number;
      if (sortKey === "openTickets") {
        cmp = a.openTickets - b.openTickets;
      } else if (sortKey === "companyType") {
        cmp = companyTypeLabel(a.companyType).localeCompare(
          companyTypeLabel(b.companyType),
          "de",
        );
      } else {
        cmp = String(a[sortKey] ?? "").localeCompare(
          String(b[sortKey] ?? ""),
          "de",
        );
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, q, typeFilter, sortKey, sortDir]);

  function SortHead({
    label,
    col,
    align,
    dragProps,
  }: {
    label: string;
    col: SortKey;
    align?: "right";
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
        className={cn(
          align === "right" && "text-right",
          "data-[dragover]:bg-accent data-[dragging]:opacity-60 cursor-grab transition-colors active:cursor-grabbing",
        )}
        title="Spalte ziehen, um die Reihenfolge zu ändern"
        {...dragProps}
      >
        <Button
          variant="ghost"
          size="sm"
          className={cn("-ml-2 h-8", align === "right" && "-mr-2 ml-auto")}
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
    align?: "right";
    cellClassName?: string;
    cell: (c: CompanyRow) => React.ReactNode;
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
      id: "city",
      label: "Ort",
      sortKey: "city",
      cellClassName: "text-muted-foreground",
      cell: (c) => (
        <TruncatedText className="max-w-44">{c.city || "—"}</TruncatedText>
      ),
    },
    {
      id: "type",
      label: "Kundenart",
      sortKey: "companyType",
      cellClassName: "text-muted-foreground",
      cell: (c) => companyTypeLabel(c.companyType),
    },
    {
      id: "phone",
      label: "Telefon",
      sortKey: "phone",
      cellClassName: "text-muted-foreground tabular-nums whitespace-nowrap",
      cell: (c) => c.phone || "—",
    },
    {
      id: "open",
      label: "Offene Tickets",
      sortKey: "openTickets",
      align: "right",
      cellClassName: "text-right",
      cell: (c) =>
        c.openTickets > 0 ? (
          <Badge variant="secondary" className="tabular-nums">
            {openCapped ? "~" : ""}
            {c.openTickets}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];
  const { order, headProps, reset, customized } = useColumnOrder(
    "cols:companies",
    columnDefs.map((c) => c.id),
  );
  const colMap = Object.fromEntries(columnDefs.map((c) => [c.id, c]));
  const orderedCols = order.map((id) => colMap[id]).filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full min-w-48 flex-1 sm:max-w-sm">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Firma oder Ort suchen …"
            className="pl-9"
            aria-label="Firmen filtern"
          />
        </div>
        <Select
          items={typeItems}
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(String(v))}
        >
          <SelectTrigger size="sm" className="w-auto min-w-40" aria-label="Kundenart">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {typeItems.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <span className="text-muted-foreground text-sm whitespace-nowrap">
          {filtered.length} von {rows.length}
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

      {(companiesCapped || openCapped) && (
        <p className="text-muted-foreground text-xs">
          {companiesCapped && "Liste auf die ersten Firmen begrenzt. "}
          {openCapped && "Spalte „Offene Tickets“ ist näherungsweise (~)."}
        </p>
      )}

      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Building2Icon />
            </EmptyMedia>
            <EmptyTitle>Keine Firmen</EmptyTitle>
            <EmptyDescription>
              {q.trim() || typeFilter !== "all"
                ? "Keine Firma passt zu Filter/Suche."
                : "Es sind keine aktiven Firmen vorhanden."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table className="min-w-2xl">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {orderedCols.map((col) => (
                  <SortHead
                    key={col.id}
                    label={col.label}
                    col={col.sortKey}
                    align={col.align}
                    dragProps={headProps(col.id)}
                  />
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => openCompanyPopup(c.id)}
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
      )}
    </div>
  );
}
