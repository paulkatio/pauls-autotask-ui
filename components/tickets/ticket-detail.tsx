"use client";

import * as React from "react";
import {
  Building2Icon,
  ChevronDownIcon,
  ClockIcon,
  DownloadIcon,
  FileIcon,
  MailIcon,
  MapPinIcon,
  MessageSquarePlusIcon,
  PhoneIcon,
  SmartphoneIcon,
  UserCheckIcon,
  UserIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { TicketChat } from "@/components/tickets/ticket-chat";
import { TimeTracking } from "@/components/tickets/time-tracking";
import { NoteForm } from "@/components/tickets/note-form";
import { AttachmentUpload } from "@/components/tickets/attachment-upload";
import {
  TicketFieldSelect,
  StatusEdit,
  CategoryEdit,
  AssignmentEdit,
  RefCombobox,
  CompanyChange,
  DescriptionEdit,
} from "@/components/tickets/meta-edit";
import { labelOf, priorityVariant } from "@/lib/autotask/mappers";
import { StatusBadge } from "@/components/status-indicator";
import { directionOf } from "@/lib/autotask/conversation";
import { formatHours } from "@/lib/format";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { TicketPicklists, TicketNote } from "@/lib/autotask/types";
import type { NotePicklists } from "@/lib/autotask/entities/picklists";
import type { ResourceOption } from "@/lib/autotask/entities/resources";
import type {
  TicketDetail,
  EnrichedTimeEntry,
} from "@/lib/autotask/entities/ticket-detail";

function fmtDate(iso?: string | null, withTime = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(d);
}

function fmtTime(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function fmtBytes(n?: number): string {
  if (n == null || !Number.isFinite(n)) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function isOverdue(due?: string | null, completed?: string | null): boolean {
  if (!due || completed) return false;
  const d = new Date(due).getTime();
  return Number.isFinite(d) && d < Date.now();
}

// Beschriftetes Feld (linke Meta-Schiene + rechte Kontextkarten).
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
      {children}
    </span>
  );
}

// Eine Schiene (links/rechts): auf Mobile einklappbar, ab md immer offen.
function Rail({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  const isBelowLg = useIsMobile(1024);
  const [open, setOpen] = React.useState(false);
  return (
    <Collapsible
      open={!isBelowLg || open}
      onOpenChange={setOpen}
      className={cn("flex w-full flex-col gap-3", className)}
    >
      <CollapsibleTrigger
        render={
          <Button variant="outline" className="h-11 w-full justify-between lg:hidden" />
        }
      >
        {title}
        <ChevronDownIcon className="text-muted-foreground" />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

// Lange Texte (Notizen, Lösung, weitergeleitete Mail-Ketten) einklappen, bis der
// Nutzer „Mehr anzeigen" klickt. Verhindert endlose Karten – v. a. auf dem Smartphone.
function ExpandableText({ text }: { text: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const isLong = text.length > 800 || (text.match(/\n/g)?.length ?? 0) > 14;
  return (
    <div className="flex flex-col items-start gap-1">
      <p
        className={cn(
          "w-full break-words whitespace-pre-wrap text-sm",
          isLong && !expanded && "line-clamp-[14]",
        )}
      >
        {text}
      </p>
      {isLong && (
        <Button variant="ghost" size="sm" className="h-11 sm:h-7" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Weniger anzeigen" : "Mehr anzeigen"}
        </Button>
      )}
    </div>
  );
}

interface Props {
  detail: TicketDetail;
  picklists: TicketPicklists;
  notePicklists: NotePicklists;
  resourceOptions: ResourceOption[];
  me: { name: string; avatar: string };
}

export function TicketDetailView({
  detail,
  picklists,
  notePicklists,
  resourceOptions,
  me,
}: Props) {
  const { ticket, company, contact, device, timeTotals } = detail;
  const overdue = isOverdue(ticket.dueDateTime, ticket.completedDate);

  // ===== LINKS: Meta-Schiene (Inline-Edits aus B15b/c) =====
  const leftRail = (
    <Rail title="Ticketinformationen" className="lg:w-72 lg:shrink-0">

      <Card>
        <CardContent className="flex flex-col gap-4">
          <Field label="Firma">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">{company?.name ?? "—"}</span>
              <CompanyChange ticketId={ticket.id} currentName={company?.name ?? null} />
            </div>
          </Field>
          <Field label="Kontakt">
            <RefCombobox
              ticketId={ticket.id}
              field="contactID"
              valueLabel={contact?.name || null}
              options={detail.refOptions.contacts}
              placeholder="Kontakt wählen"
            />
          </Field>
          <Field label="Status">
            <StatusEdit
              ticketId={ticket.id}
              value={ticket.status}
              options={picklists.status}
              ariaLabel="Status"
            />
          </Field>
          <Field label="Priorität">
            <TicketFieldSelect
              ticketId={ticket.id}
              field="priority"
              value={ticket.priority}
              options={picklists.priority}
              ariaLabel="Priorität"
            />
          </Field>

          <Separator />
          <GroupLabel>Ticketinformationen</GroupLabel>
          <Field label="Kategorie / Unterkategorie">
            <CategoryEdit
              ticketId={ticket.id}
              issueType={ticket.issueType}
              subIssueType={ticket.subIssueType}
              issueOptions={picklists.issueType}
              subOptions={picklists.subIssueType}
            />
          </Field>
          <Field label="Quelle">{labelOf(picklists.source, ticket.source)}</Field>
          <Field label="Fälligkeitsdatum">
            <span className={cn("tabular-nums", overdue && "text-destructive font-medium")}>
              {fmtDate(ticket.dueDateTime, true)}
            </span>
          </Field>

          <Separator />
          <GroupLabel>Zuweisung</GroupLabel>
          <Field label="Queue">
            <TicketFieldSelect
              ticketId={ticket.id}
              field="queueID"
              value={ticket.queueID}
              options={picklists.queue}
              ariaLabel="Queue"
            />
          </Field>
          <Field label="Verantwortlicher Mitarbeiter">
            <AssignmentEdit
              ticketId={ticket.id}
              assignedResourceID={ticket.assignedResourceID}
              assignedResourceName={detail.assignedResourceName}
              resources={resourceOptions}
            />
          </Field>

          <Separator />
          <GroupLabel>Gerät</GroupLabel>
          <Field label="Gerät">
            <RefCombobox
              ticketId={ticket.id}
              field="configurationItemID"
              valueLabel={
                device
                  ? [device.title, device.number].filter(Boolean).join(" · ") || null
                  : null
              }
              options={detail.refOptions.devices}
              placeholder="Gerät wählen"
            />
          </Field>

          <Separator />
          <GroupLabel>Rechnungsstellung</GroupLabel>
          <Field label="Vertrag">
            <RefCombobox
              ticketId={ticket.id}
              field="contractID"
              valueLabel={detail.contractName}
              options={detail.refOptions.contracts}
              placeholder="Vertrag wählen"
            />
          </Field>
        </CardContent>
      </Card>
    </Rail>
  );

  // ===== MITTE: Beschreibung, Lösung, Tabs [Zeiten | Anhänge] =====
  // Zeiten ist die Standardansicht; darunter die Aktivität (Notizen).
  const center = (
    <main className="flex w-full min-w-0 flex-1 flex-col gap-6">
      <DescriptionEdit ticketId={ticket.id} value={ticket.description} />

      {detail.resolution && (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Lösung</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpandableText text={detail.resolution} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Tabs defaultValue="zeiten" className="gap-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
              <TabsList variant="line">
                <TabsTrigger value="zeiten" className="min-h-11 sm:min-h-0">
                  Zeiten
                </TabsTrigger>
                <TabsTrigger value="anhaenge" className="min-h-11 sm:min-h-0">
                  Anhänge ({detail.attachments.length})
                </TabsTrigger>
              </TabsList>
              <TimeTracking ticketId={ticket.id} />
            </div>

            {/* Zeiten (Standard) + darunter Aktivität (Notizen) */}
            <TabsContent value="zeiten">
              <div className="flex flex-col gap-6">
                <TimeEntriesList entries={detail.timeEntries} />
                <Separator />
                <ActivitySection
                  ticketId={ticket.id}
                  notes={detail.notes}
                  notePicklists={notePicklists}
                />
              </div>
            </TabsContent>

            <TabsContent value="anhaenge">
              <div className="flex flex-col gap-3">
                <AttachmentUpload ticketId={ticket.id} />
                <AttachmentsList ticketId={ticket.id} items={detail.attachments} />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );

  // ===== RECHTS: kompakter Kontext + Chat-Sidebar (rein lesend, kein sticky
  // wegen Chat-Höhe) =====
  const rightRail = (
    <div className="flex w-full flex-col gap-4 xl:w-72 xl:shrink-0 2xl:w-80">
      {/* Firma + Ansprechpartner ZUERST, über dem Chat – damit beim Schreiben
          sofort sichtbar ist, mit wem kommuniziert wird. Alles bricht sauber um. */}
      {(company || contact) && (
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-base break-words">
              {company?.name ?? "Kontakt"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {contact ? (
              <>
                <span className="font-medium break-words">{contact.name}</span>
                {contact.title && (
                  <span className="text-muted-foreground break-words">
                    {contact.title}
                  </span>
                )}
                {contact.email && (
                  <span className="text-muted-foreground flex items-center gap-1.5 break-all">
                    <MailIcon className="size-3.5 shrink-0" /> {contact.email}
                  </span>
                )}
                {contact.phone && (
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <PhoneIcon className="size-3.5 shrink-0" />
                    <span className="break-all">{contact.phone}</span>
                  </span>
                )}
                {contact.mobilePhone && (
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <SmartphoneIcon className="size-3.5 shrink-0" />
                    <span className="break-all">{contact.mobilePhone}</span>
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">Kein Kontakt hinterlegt.</span>
            )}
          </CardContent>
        </Card>
      )}

      <TicketChat ticketId={ticket.id} me={me} contactName={contact?.name ?? null} />

      <Rail title="Kontext">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Arbeitszeit &amp; Abrechnung</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Gearbeitet">
              <span className="font-medium tabular-nums">
                {formatHours(timeTotals.worked)}
              </span>
            </Field>
            <Field label="Geschätzt">
              <span className="font-medium tabular-nums">
                {timeTotals.estimated != null
                  ? formatHours(timeTotals.estimated)
                  : "—"}
              </span>
            </Field>
            <Field label="Abrechenbar">
              <span className="font-medium tabular-nums">
                {formatHours(timeTotals.billable)}
              </span>
            </Field>
            <Field label="Nicht abrechenbar">
              <span className="font-medium tabular-nums">
                {formatHours(timeTotals.nonBillable)}
              </span>
            </Field>
          </div>
        </CardContent>
      </Card>

      {device && (
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-base">Gerät</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {device.title && <Field label="Name">{device.title}</Field>}
            {device.serialNumber && (
              <Field label="Seriennummer">
                <span className="break-all">{device.serialNumber}</span>
              </Field>
            )}
            {device.number && (
              <Field label="Referenznummer">
                <span className="break-all">{device.number}</span>
              </Field>
            )}
            {device.location && (
              <Field label="Standort">
                <span className="flex items-center gap-1.5">
                  <MapPinIcon className="text-muted-foreground size-3.5" />
                  {device.location}
                </span>
              </Field>
            )}
            {device.installDate && (
              <Field label="Installiert">
                <span className="tabular-nums">{fmtDate(device.installDate)}</span>
              </Field>
            )}
            {device.warrantyExpirationDate && (
              <Field label="Ablauf der Garantie">
                <span className="tabular-nums">
                  {fmtDate(device.warrantyExpirationDate)}
                </span>
              </Field>
            )}
          </CardContent>
        </Card>
      )}

      </Rail>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Desktop-Kopf: „Nummer – Titel" fett, daneben „Erstellt …". */}
      <div className="hidden flex-wrap items-baseline gap-x-3 gap-y-1 md:flex">
        <h1 className="text-2xl font-semibold tracking-tight text-balance break-words">
          <span className="tabular-nums">{ticket.ticketNumber}</span>
          {ticket.title ? ` – ${ticket.title}` : ""}
        </h1>
        <span className="text-muted-foreground text-sm whitespace-nowrap">
          Erstellt {fmtDate(ticket.createDate, true)}
        </span>
      </div>

      {/* Mobiler Case-Header (md:hidden): App-artiger Summary statt Label/Wert-Tabelle.
          Reihenfolge mit Luft: Titelblock → Statuschips → Kontextgruppe.
          Nur semantische Tokens; Desktop hat den Kontext in den Schienen. */}
      <div className="flex flex-col gap-4 md:hidden">
        {/* Titelblock: Nummer als Eyebrow, Titel dominant aber straff. */}
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground text-xs font-medium tabular-nums">
            {ticket.ticketNumber}
          </span>
          <h1 className="text-xl leading-snug font-semibold tracking-tight break-words">
            {ticket.title ?? "—"}
          </h1>
        </div>

        {/* Statuszeile: Priorität + Status als Chips. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={priorityVariant(ticket.priority)}>
            {labelOf(picklists.priority, ticket.priority)}
          </Badge>
          <StatusBadge
            status={ticket.status}
            label={labelOf(picklists.status, ticket.status)}
          />
        </div>

        {/* Kontextgruppe: Firma primär, Kontakt · Verantwortlich sekundär, Erstellt muted. */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Building2Icon className="text-muted-foreground size-4 shrink-0" />
            <span className="min-w-0 break-words">{company?.name ?? "—"}</span>
          </div>
          {(contact?.name || detail.assignedResourceName) && (
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              {contact?.name && (
                <span className="flex items-center gap-1.5">
                  <UserIcon className="size-3.5 shrink-0" />
                  <span className="min-w-0 break-words">{contact.name}</span>
                </span>
              )}
              {contact?.name && detail.assignedResourceName && (
                <span aria-hidden>·</span>
              )}
              {detail.assignedResourceName && (
                <span className="flex items-center gap-1.5">
                  <UserCheckIcon className="size-3.5 shrink-0" />
                  <span className="min-w-0 break-words">
                    {detail.assignedResourceName}
                  </span>
                </span>
              )}
            </div>
          )}
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <ClockIcon className="size-3.5 shrink-0" />
            <span className="tabular-nums">
              Erstellt {fmtDate(ticket.createDate, true)}
            </span>
          </div>
        </div>
      </div>

      {/* 3 Spalten ab xl; ab lg zwei Spalten + Kontext darunter; darunter gestapelt
          (Feed bekommt bis lg die volle Breite, statt sich ab md mit der Meta-Schiene
          ~512 px zu teilen). Collapsible-Trigger der Rail ist lg:hidden, passend zur
          useIsMobile(1024)-Schwelle — so ist die Meta-Schiene bei 768–1023 (iPad
          hochkant) einklappbar statt zwangs-offen über dem Inhalt. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:flex-wrap lg:items-start xl:flex-nowrap">
        {leftRail}
        {center}
        {rightRail}
      </div>
    </div>
  );
}

// ----- Aktivität (Notizen) – unter den Zeiten. Header trägt den Auf-/Einklappen-
// Button (neben "Aktivität") und die "Neue Notiz"-Aktion. -----
function ActivitySection({
  ticketId,
  notes,
  notePicklists,
}: {
  ticketId: number;
  notes: TicketNote[];
  notePicklists: NotePicklists;
}) {
  const sorted = React.useMemo(
    () =>
      [...notes].sort(
        (a, b) =>
          (Date.parse(b.createDateTime ?? "") || 0) -
          (Date.parse(a.createDateTime ?? "") || 0),
      ),
    [notes],
  );
  // Standardmäßig sind nur Kundenantworten (inbound) offen; der Rest eingeklappt.
  const [openSet, setOpenSet] = React.useState<Set<number>>(
    () => new Set(sorted.filter((n) => directionOf(n) === "inbound").map((n) => n.id)),
  );
  const allOpen = sorted.length > 0 && sorted.every((n) => openSet.has(n.id));
  const [noteOpen, setNoteOpen] = React.useState(false);
  function toggle(id: number) {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <h3 className="text-sm font-semibold">Aktivität</h3>
          {sorted.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-11 sm:h-7"
              onClick={() =>
                setOpenSet(allOpen ? new Set() : new Set(sorted.map((n) => n.id)))
              }
            >
              {allOpen ? "Alle einklappen" : "Alle aufklappen"}
            </Button>
          )}
        </div>
        {!noteOpen && (
          <Button variant="outline" size="sm" className="h-11 sm:h-7" onClick={() => setNoteOpen(true)}>
            <MessageSquarePlusIcon />
            Neue Notiz
          </Button>
        )}
      </div>
      {noteOpen && (
        <NoteForm ticketId={ticketId} onClose={() => setNoteOpen(false)} />
      )}
      {sorted.length === 0 ? (
        <p className="text-muted-foreground text-sm">Keine Notizen vorhanden.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((note) => (
            <ActivityItem
              key={note.id}
              note={note}
              notePicklists={notePicklists}
              open={openSet.has(note.id)}
              onToggle={() => toggle(note.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Eine Aktivität: standardmäßig EINGEKLAPPT (nur Typ + Titel + Datum), per Klick
// aufklappbar. Ausnahme: Kundenantworten (inbound) sind das Signal → offen und mit
// hervorgehobenem „Kundenantwort"-Badge. So verschwindet das RMM-/Workflow-/System-
// Rauschen aus dem Blickfeld, ohne dass etwas verloren geht.
function ActivityItem({
  note,
  notePicklists,
  open,
  onToggle,
}: {
  note: TicketNote;
  notePicklists: NotePicklists;
  open: boolean;
  onToggle: () => void;
}) {
  const isReply = directionOf(note) === "inbound";
  const hasBody = Boolean(note.description);
  return (
    <div className="flex flex-col gap-1 border-b pb-3">
      <button
        type="button"
        onClick={onToggle}
        className="-my-1 flex min-h-11 w-full flex-wrap items-center gap-x-2 gap-y-0.5 py-1.5 text-left sm:my-0 sm:min-h-0 sm:flex-nowrap sm:py-0"
        aria-expanded={open}
      >
        <ChevronDownIcon
          className={cn(
            "text-muted-foreground size-4 shrink-0 transition-transform",
            !open && "-rotate-90",
          )}
        />
        {isReply ? (
          <Badge className="min-w-0 shrink truncate sm:shrink-0">Kundenantwort</Badge>
        ) : (
          <Badge variant="secondary" className="min-w-0 shrink truncate sm:shrink-0">
            {labelOf(notePicklists.noteType, note.noteType)}
          </Badge>
        )}
        {note.title && (
          <span className="order-3 min-w-0 basis-full truncate text-sm font-medium sm:order-2 sm:basis-auto sm:flex-1">
            {note.title}
          </span>
        )}
        <span className="text-muted-foreground order-2 ml-auto shrink-0 text-xs tabular-nums sm:order-3">
          {fmtDate(note.createDateTime, true)}
        </span>
      </button>
      {open && hasBody && (
        <div className="pl-6">
          <ExpandableText text={note.description ?? ""} />
        </div>
      )}
    </div>
  );
}

// ----- Zeiten-Tab: dedizierte TimeEntries-Liste -----
function TimeEntriesList({ entries }: { entries: EnrichedTimeEntry[] }) {
  if (entries.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Keine Zeiteinträge</EmptyTitle>
          <EmptyDescription>
            Für dieses Ticket wurden noch keine Zeiten erfasst.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  const sorted = [...entries].sort(
    (a, b) =>
      (Date.parse(b.dateWorked ?? b.startDateTime ?? "") || 0) -
      (Date.parse(a.dateWorked ?? a.startDateTime ?? "") || 0),
  );
  return (
    <div className="flex flex-col gap-4">
      {sorted.map((e) => {
        const from = fmtTime(e.startDateTime);
        const to = fmtTime(e.endDateTime);
        return (
          <div key={e.id} className="flex flex-col gap-1 border-b pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium tabular-nums">
                {formatHours(e.hoursWorked)}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {fmtDate(e.dateWorked)}
                {from && to ? ` · ${from}–${to}` : ""}
              </span>
              {e.workTypeName && (
                <Badge variant="secondary">{e.workTypeName}</Badge>
              )}
            </div>
            {e.resourceName && (
              <span className="text-muted-foreground text-xs">
                {e.resourceName}
              </span>
            )}
            {e.summaryNotes && (
              <p className="text-sm break-words whitespace-pre-wrap">{e.summaryNotes}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ----- Anhänge-Tab: Liste + Download über interne Route -----
function AttachmentsList({
  ticketId,
  items,
}: {
  ticketId: number;
  items: TicketDetail["attachments"];
}) {
  if (items.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileIcon />
          </EmptyMedia>
          <EmptyTitle>Keine Anhänge</EmptyTitle>
          <EmptyDescription>
            An diesem Ticket sind keine Dateien angehängt.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((a) => {
        const name = a.fullPath || a.title || `Anhang ${a.id}`;
        const meta = [a.contentType, fmtBytes(a.fileSize), fmtDate(a.attachDate)]
          .filter(Boolean)
          .join(" · ");
        return (
          <div
            key={a.id}
            className="flex items-center gap-3 rounded-lg border p-3"
          >
            <FileIcon className="text-muted-foreground size-5 shrink-0" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{name}</span>
              <span className="text-muted-foreground truncate text-xs">
                {meta}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto shrink-0"
              nativeButton={false}
              render={
                <a
                  href={`/api/tickets/${ticketId}/attachments/${a.id}`}
                  download={name}
                  aria-label={`${name} herunterladen`}
                />
              }
            >
              <DownloadIcon />
              Laden
            </Button>
          </div>
        );
      })}
    </div>
  );
}
