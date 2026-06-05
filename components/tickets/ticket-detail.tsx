"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDownIcon,
  DownloadIcon,
  FileIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  SmartphoneIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
  CategoryEdit,
  AssignmentEdit,
  RefCombobox,
  CompanyChange,
  DescriptionEdit,
} from "@/components/tickets/meta-edit";
import { labelOf } from "@/lib/autotask/mappers";
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
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);
  return (
    <Collapsible
      open={!isMobile || open}
      onOpenChange={setOpen}
      className={cn("flex w-full flex-col gap-3", className)}
    >
      <CollapsibleTrigger
        render={
          <Button variant="outline" className="w-full justify-between md:hidden" />
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

interface Props {
  detail: TicketDetail;
  picklists: TicketPicklists;
  notePicklists: NotePicklists;
  resourceOptions: ResourceOption[];
}

export function TicketDetailView({
  detail,
  picklists,
  notePicklists,
  resourceOptions,
}: Props) {
  const { ticket, company, contact, device, timeTotals } = detail;
  const typeLabel = labelOf(picklists.ticketType, ticket.ticketType, "");
  const overdue = isOverdue(ticket.dueDateTime, ticket.completedDate);

  // ===== LINKS: Meta-Schiene (Inline-Edits aus B15b/c) =====
  const leftRail = (
    <Rail title="Ticketinformationen" className="md:w-72 md:shrink-0">

      <Card>
        <CardContent className="flex flex-col gap-4">
          <Field label="Firma">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">{company?.name ?? "—"}</span>
              <CompanyChange ticketId={ticket.id} currentName={company?.name ?? null} />
            </div>
          </Field>
          <Field label="Kontakt">
            <div className="flex flex-col gap-1">
              <RefCombobox
                ticketId={ticket.id}
                field="contactID"
                valueLabel={contact?.name || null}
                options={detail.refOptions.contacts}
                placeholder="Kontakt wählen"
              />
              {contact?.email && (
                <span className="text-muted-foreground truncate text-xs">
                  {contact.email}
                </span>
              )}
              {contact?.receivesEmailNotifications != null && (
                <Badge variant="secondary" className="w-fit">
                  {contact.receivesEmailNotifications
                    ? "E-Mail-Benachrichtigung: an"
                    : "E-Mail-Benachrichtigung: aus"}
                </Badge>
              )}
            </div>
          </Field>
          <Field label="Status">
            <TicketFieldSelect
              ticketId={ticket.id}
              field="status"
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
      <Card>
        <CardHeader>
          <CardTitle>Beschreibung</CardTitle>
        </CardHeader>
        <CardContent>
          <DescriptionEdit ticketId={ticket.id} value={ticket.description} />
        </CardContent>
      </Card>

      {detail.resolution && (
        <Card>
          <CardHeader>
            <CardTitle>Lösung</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{detail.resolution}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Tabs defaultValue="zeiten" className="gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <TabsList variant="line">
                <TabsTrigger value="zeiten">Zeiten</TabsTrigger>
                <TabsTrigger value="anhaenge">
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
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Aktivität</h3>
                    <NoteForm ticketId={ticket.id} />
                  </div>
                  <NotesFeed notes={detail.notes} notePicklists={notePicklists} />
                </div>
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
    <Rail title="Kontext & Chat" className="xl:w-80 xl:shrink-0">
      {(company || contact) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {company?.name ?? "Kontakt"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {contact ? (
              <>
                <span className="font-medium">{contact.name}</span>
                {contact.title && (
                  <span className="text-muted-foreground">{contact.title}</span>
                )}
                {contact.email && (
                  <span className="text-muted-foreground flex items-center gap-1.5 break-all">
                    <MailIcon className="size-3.5 shrink-0" /> {contact.email}
                  </span>
                )}
                {contact.phone && (
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <PhoneIcon className="size-3.5" /> {contact.phone}
                  </span>
                )}
                {contact.mobilePhone && (
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <SmartphoneIcon className="size-3.5" /> {contact.mobilePhone}
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">Kein Kontakt hinterlegt.</span>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
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
          <CardHeader>
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

      <TicketChat ticketId={ticket.id} />
    </Rail>
  );

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/tickets/my" />}>
              Tickets
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{ticket.ticketNumber ?? "Ticket"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Kopf (volle Breite): Typ, Nummer, Titel, Erstellt */}
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {typeLabel && <Badge variant="secondary">{typeLabel}</Badge>}
          <span className="text-muted-foreground tabular-nums">
            {ticket.ticketNumber}
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {ticket.title ?? ticket.ticketNumber}
        </h1>
        <p className="text-muted-foreground text-sm">
          Erstellt {fmtDate(ticket.createDate, true)}
        </p>
      </div>

      {/* 3 Spalten ab xl; ab md zwei Spalten + Kontext darunter; mobil gestapelt. */}
      <div className="flex flex-col gap-6 md:flex-row md:flex-wrap md:items-start xl:flex-nowrap">
        {leftRail}
        {center}
        {rightRail}
      </div>
    </div>
  );
}

// ----- Aktivität (Notizen) – unter den Zeiten -----
function NotesFeed({
  notes,
  notePicklists,
}: {
  notes: TicketNote[];
  notePicklists: NotePicklists;
}) {
  if (notes.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Keine Notizen vorhanden.</p>
    );
  }
  const sorted = [...notes].sort(
    (a, b) =>
      (Date.parse(b.createDateTime ?? "") || 0) -
      (Date.parse(a.createDateTime ?? "") || 0),
  );
  return (
    <div className="flex flex-col gap-4">
      {sorted.map((note) => (
        <div key={note.id} className="flex flex-col gap-1 border-b pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {labelOf(notePicklists.noteType, note.noteType)}
            </Badge>
            <Badge variant="outline">
              {labelOf(notePicklists.publish, note.publish)}
            </Badge>
            <span className="text-muted-foreground text-xs tabular-nums">
              {fmtDate(note.createDateTime, true)}
            </span>
          </div>
          {note.title && (
            <span className="text-sm font-medium">{note.title}</span>
          )}
          {note.description && (
            <p className="text-sm whitespace-pre-wrap">{note.description}</p>
          )}
        </div>
      ))}
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
              <p className="text-sm whitespace-pre-wrap">{e.summaryNotes}</p>
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
