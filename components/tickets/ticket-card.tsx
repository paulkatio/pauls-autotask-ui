"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/status-indicator";
import { labelOf } from "@/lib/autotask/mappers";
import { PriorityBadge } from "@/components/priority-indicator";
import { useRecordNav } from "@/hooks/use-record-nav";
import type { TicketPicklists } from "@/lib/autotask/types";
import type { TicketRow } from "@/components/tickets/tickets-list";

// Gemeinsame mobile Ticket-Karte. EINE Hierarchie für ALLE Listen (Worklist
// wie Aktivitätsfeed), damit die Karten erkennbar ein System sind:
//   1. Titel          – primärer Anker
//   2. Firma · Nummer  – sekundäre Meta-Zeile
//   3. Chips           – Status / Priorität / Queue / Bearbeiter
//   4. Kontextdatum    – letzte, dezente Zeile
//
// Die BEDEUTUNG des Datums variiert je Kontext (das ist der einzige Unterschied
// zwischen den Varianten); deshalb wird sie über `date` explizit hereingereicht,
// statt blind „Bearbeitet" anzuzeigen:
//   - variant="worklist"  → Standard "Fällig …" (dueDateTime, absolut)
//   - variant="activity"  → z. B. "Aktualisiert …" (lastActivityDate, relativ)

// Absolutes Datum (Worklist – Fälligkeit).
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

// Relativ + lesbar (Aktivitätsfeed): „gerade eben", „vor 12 Min", „heute 10:24",
// „gestern 16:03", sonst Datum. (Client → lokale Zeit.)
function relTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return "—";
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min`;
  const time = new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  const startOfDay = (x: Date) => {
    const y = new Date(x);
    y.setHours(0, 0, 0, 0);
    return y.getTime();
  };
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (days <= 0) return `heute ${time}`;
  if (days === 1) return `gestern ${time}`;
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export type TicketCardVariant = "worklist" | "activity";

// Welche Felder gezeigt werden (wie in der Tabelle ein-/ausblendbar).
export interface TicketCardColumns {
  company?: boolean;
  queue?: boolean;
  assigned?: boolean;
}

export function TicketCard({
  ticket: t,
  picklists,
  variant = "worklist",
  columns = {},
  date,
  selectable = false,
  selected = false,
  onToggleSelect,
}: {
  ticket: TicketRow;
  picklists: TicketPicklists;
  variant?: TicketCardVariant;
  columns?: TicketCardColumns;
  // Explizites Kontextdatum. Ohne Angabe greift der Varianten-Default
  // (worklist → Fällig/dueDateTime; activity → Aktualisiert/lastActivityDate).
  date?: { label: string; iso: string | null; relative?: boolean };
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (checked: boolean) => void;
}) {
  const { openTicket } = useRecordNav();
  const showCompany = columns.company !== false && !!t.companyName;
  const showAssignee =
    !!t.assignedResourceName && (variant === "activity" || !!columns.assigned);

  // Datum auflösen: explizit > Varianten-Default. Im Aktivitätsfeed ist bei einem
  // noch NEUEN Ticket (Autotask-System-Status 1 = Neu) das Erstelldatum die
  // sprechendere Information als „Aktualisiert" – sonst die letzte Aktivität.
  const isNew = t.status === 1;
  const resolved =
    date ??
    (variant === "activity"
      ? isNew && t.createDate
        ? { label: "Erstellt", iso: t.createDate, relative: true }
        : { label: "Aktualisiert", iso: t.lastActivityDate ?? null, relative: true }
      : { label: "Fällig", iso: t.dueDateTime ?? null, relative: false });
  const dateText = resolved.iso
    ? `${resolved.label} ${resolved.relative ? relTime(resolved.iso) : formatDate(resolved.iso)}`
    : null;

  // Firma + Nummer getrennt: die Nummer ist der eindeutige Identifikator und darf
  // nie abgeschnitten werden. Nur die Firma trunkiert bei Platzmangel.
  const companyLabel = showCompany ? t.companyName : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openTicket(t.id)}
      onKeyDown={(e) => {
        // Nur reagieren, wenn die Karte selbst fokussiert ist – nicht, wenn das
        // Keydown von einem Kind (z. B. der Auswahl-Checkbox) hochbubbelt.
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openTicket(t.id);
        }
      }}
      className="hover:bg-muted/50 active:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 flex items-start gap-3 rounded-lg border p-3 transition-colors outline-none focus-visible:ring-3"
    >
      {selectable && (
        <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
          <Checkbox
            checked={selected}
            onCheckedChange={(c) => onToggleSelect?.(c === true)}
            aria-label={`Ticket ${t.ticketNumber} auswählen`}
          />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-sm font-medium break-words">{t.title ?? "—"}</span>
        <span className="text-muted-foreground flex min-w-0 items-center gap-1 text-xs">
          {companyLabel && <span className="truncate">{companyLabel}</span>}
          {companyLabel && <span aria-hidden>·</span>}
          <span className="shrink-0 tabular-nums">{t.ticketNumber}</span>
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge
            status={t.status}
            label={labelOf(picklists.status, t.status)}
          />
          <PriorityBadge
            priority={t.priority}
            label={labelOf(picklists.priority, t.priority)}
          />
          {showAssignee && (
            <Badge variant="outline">{t.assignedResourceName}</Badge>
          )}
        </div>
        {dateText && (
          <span className="text-muted-foreground text-xs">{dateText}</span>
        )}
      </div>
    </div>
  );
}
