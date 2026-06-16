"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Building2Icon,
  ChevronDownIcon,
  ClockIcon,
  DownloadIcon,
  FileIcon,
  ListChecksIcon,
  MailIcon,
  MapPinIcon,
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
import { Checkbox } from "@/components/ui/checkbox";
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
import { AutotaskOpenButton } from "@/components/autotask-open-button";
import { TruncatedText } from "@/components/truncated-text";
import { setHeaderTicketInfo } from "@/components/header-ticket-number";
import { TimeTracking } from "@/components/tickets/time-tracking";
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
import { SecondaryResourcesEdit } from "@/components/tickets/secondary-resources-edit";
import { labelOf } from "@/lib/autotask/mappers";
import { StatusBadge } from "@/components/status-indicator";
import { PriorityBadge } from "@/components/priority-indicator";
import {
  directionOf,
  isActivityNoise,
  isChatDuplicate,
} from "@/lib/autotask/conversation";
import { formatHours } from "@/lib/format";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type {
  TicketPicklists,
  TicketNote,
  TicketChecklistItem,
} from "@/lib/autotask/types";
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
        <ChevronDownIcon
          className={cn(
            "text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
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
  autotaskUrl: string | null;
  // Mobiler „In Autotask öffnen"-Knopf im Titelblock – nur im Pop-out (dort fehlt
  // der globale Header); in der App liefert ihn die Kopfzeile (HeaderAutotaskLink).
  showMobileAutotaskButton?: boolean;
}

export function TicketDetailView({
  detail,
  picklists,
  notePicklists,
  resourceOptions,
  me,
  autotaskUrl,
  showMobileAutotaskButton = false,
}: Props) {
  const { ticket, company, contact, device, timeTotals } = detail;
  const overdue = isOverdue(ticket.dueDateTime, ticket.completedDate);

  // Sobald der Titelbereich unter die sticky Kopfzeile gescrollt ist, Ticketnummer
  // (Mobile) bzw. Nummer + Titel (Desktop) in der Header-Leiste einblenden.
  const titleSentinelRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = titleSentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const info = {
      number: ticket.ticketNumber ?? `#${ticket.id}`,
      title: ticket.title ?? null,
    };
    const obs = new IntersectionObserver(
      ([entry]) => setHeaderTicketInfo(entry.isIntersecting ? null : info),
      { rootMargin: "-72px 0px 0px 0px", threshold: 0 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      setHeaderTicketInfo(null);
    };
  }, [ticket.ticketNumber, ticket.title, ticket.id]);

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
              ticketNumber={ticket.ticketNumber ?? `#${ticket.id}`}
              assignedResourceID={ticket.assignedResourceID}
              assignedResourceRoleID={ticket.assignedResourceRoleID}
              assignedResourceName={detail.assignedResourceName}
              resources={resourceOptions}
            />
          </Field>
          <Field label="Zusätzliche Mitarbeiter">
            <SecondaryResourcesEdit
              ticketId={ticket.id}
              current={detail.secondaryResources}
              resources={resourceOptions}
              assignedResourceID={ticket.assignedResourceID}
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

      {detail.checklist.length > 0 && (
        <ChecklistCard ticketId={ticket.id} items={detail.checklist} />
      )}

      {/* Chat direkt unter der Beschreibung, ÜBER Zeiten/Aktivität (Paul). */}
      <TicketChat ticketId={ticket.id} me={me} contactName={contact?.name ?? null} />

      <Card>
        <CardContent>
          <Tabs defaultValue="zeiten" className="gap-4">
            {/* Aktions-Header: Stoppuhr · Zeit erfassen · Neue Notiz. */}
            <TimeTracking ticketId={ticket.id} />

            {/* Leicht abgetrennt darunter die Tabs – gleicher Kasten. */}
            <div className="flex flex-col gap-4 border-t pt-4">
              <TabsList variant="line">
                <TabsTrigger value="zeiten" className="min-h-11 sm:min-h-0">
                  Zeiten
                </TabsTrigger>
                <TabsTrigger value="anhaenge" className="min-h-11 sm:min-h-0">
                  Anhänge ({detail.attachments.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="zeiten">
                <TimeEntriesList entries={detail.timeEntries} />
              </TabsContent>

              <TabsContent value="anhaenge">
                <div className="flex flex-col gap-3">
                  <AttachmentUpload ticketId={ticket.id} />
                  <AttachmentsList ticketId={ticket.id} items={detail.attachments} />
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Aktivität: eigener, standardmäßig eingeklappter Bereich – unabhängig von Zeiten. */}
      <ActivitySection notes={detail.notes} notePicklists={notePicklists} />
    </main>
  );

  // ===== RECHTS: kompakter Kontext (Firma/Kontakt + Arbeitszeit). Der Chat sitzt
  // jetzt im Mittel-Strang unter der Beschreibung. =====
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
      {/* Desktop-Kopf: „Nummer – Titel" fett – sehr lange Titel werden einzeilig
          gekürzt und beim Hover als Tooltip voll gezeigt (nur wenn wirklich
          abgeschnitten). Datum + „In Autotask öffnen" liegen rechts in einer
          nicht schrumpfenden Zone, damit der Button nie umbricht. */}
      <div className="hidden items-center gap-3 md:flex">
        <h1 className="min-w-0 flex-1 text-2xl font-semibold tracking-tight">
          <TruncatedText>
            {`${ticket.ticketNumber ?? ""}${ticket.title ? ` – ${ticket.title}` : ""}`}
          </TruncatedText>
        </h1>
        <span className="text-muted-foreground shrink-0 text-sm whitespace-nowrap">
          Erstellt {fmtDate(ticket.createDate, true)}
        </span>
        <div className="shrink-0">
          <AutotaskOpenButton href={autotaskUrl} label="In Autotask öffnen" />
        </div>
      </div>

      {/* Mobiler Case-Header (md:hidden): App-artiger Summary statt Label/Wert-Tabelle.
          Reihenfolge mit Luft: Titelblock → Statuschips → Kontextgruppe.
          Nur semantische Tokens; Desktop hat den Kontext in den Schienen. */}
      <div className="flex flex-col gap-4 md:hidden">
        {/* Titelblock: Nummer als Eyebrow, Titel dominant aber straff; rechts der
            Autotask-Icon-Link (Popup hat keinen globalen Header → hier eingebaut). */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-muted-foreground text-xs font-medium tabular-nums">
              {ticket.ticketNumber}
            </span>
            <h1 className="text-xl leading-snug font-semibold tracking-tight break-words">
              {ticket.title ?? "—"}
            </h1>
          </div>
          {showMobileAutotaskButton && (
            <AutotaskOpenButton
              href={autotaskUrl}
              label="Autotask"
              className="h-9 shrink-0"
            />
          )}
        </div>

        {/* Statuszeile: Priorität + Status als Chips. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <PriorityBadge
            priority={ticket.priority}
            label={labelOf(picklists.priority, ticket.priority)}
          />
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

      {/* Scroll-Sentinel: liegt direkt unter dem Titelbereich. Ist er aus dem Blick
          (unter der sticky Kopfzeile), blendet die Header-Leiste die Ticketnummer ein.
          Echte Höhe (h-px), sonst meldet der IntersectionObserver bei 0-Fläche unzuverlässig. */}
      <div ref={titleSentinelRef} aria-hidden className="h-px w-full" />

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

// ----- Ticket-Checkliste („To-Dos") – interaktives Abbild der in Autotask
// eingebauten Checkliste. Punkte abhakbar (optimistisch, PATCH über die Route;
// Fehler wird zurückgerollt). Erledigte durchgestrichen. -----
function ChecklistCard({
  ticketId,
  items,
}: {
  ticketId: number;
  items: TicketChecklistItem[];
}) {
  const [list, setList] = React.useState(items);
  // Nach router.refresh() mit den frischen Server-Daten synchronisieren – während
  // des Renders statt im Effect (React-Muster für „State aus vorherigem Render").
  const [prevItems, setPrevItems] = React.useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setList(items);
  }
  const [busy, setBusy] = React.useState<ReadonlySet<number>>(new Set());
  const done = list.filter((i) => i.isCompleted).length;

  async function toggle(item: TicketChecklistItem, next: boolean) {
    setBusy((b) => new Set(b).add(item.id));
    setList((l) =>
      l.map((x) => (x.id === item.id ? { ...x, isCompleted: next } : x)),
    );
    try {
      const res = await fetch(`/api/tickets/${ticketId}/checklist/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: next }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Speichern fehlgeschlagen.");
      }
    } catch (e) {
      // Optimistische Änderung zurückrollen.
      setList((l) =>
        l.map((x) => (x.id === item.id ? { ...x, isCompleted: !next } : x)),
      );
      toast.error(
        e instanceof Error ? e.message : "Checklisten-Punkt nicht gespeichert.",
      );
    } finally {
      setBusy((b) => {
        const n = new Set(b);
        n.delete(item.id);
        return n;
      });
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <ListChecksIcon className="size-4 shrink-0" />
          Checkliste
          <span className="text-muted-foreground text-sm font-normal tabular-nums">
            {done}/{list.length} erledigt
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1">
          {list.map((i) => (
            <li key={i.id}>
              <label className="hover:bg-muted/50 flex cursor-pointer items-start gap-2 rounded-md p-1.5 text-sm">
                <Checkbox
                  checked={i.isCompleted}
                  disabled={busy.has(i.id)}
                  onCheckedChange={(v) => toggle(i, v === true)}
                  aria-label={i.itemName ?? "Checklisten-Punkt"}
                  className="mt-0.5"
                />
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span
                    className={cn(
                      "min-w-0 break-words",
                      i.isCompleted && "text-muted-foreground line-through",
                    )}
                  >
                    {i.itemName ?? "—"}
                  </span>
                  {i.isImportant && <Badge variant="outline">Wichtig</Badge>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ----- Aktivität: EIGENER Bereich (Card), unabhängig von den Zeiten. Standardmäßig
// komplett EINGEKLAPPT (Mobile + Desktop). Aufklappen zeigt alle relevanten
// Aktivitäten direkt vollständig – kein „Alle aufklappen"/„Alle anzeigen", kein
// Auf-/Zuklappen einzelner Einträge. Rauschen + Chat-Duplikate bleiben gefiltert.
// „Neue Notiz" sitzt bei „Zeit erfassen" (NewNoteButton). -----
function ActivitySection({
  notes,
  notePicklists,
}: {
  notes: TicketNote[];
  notePicklists: NotePicklists;
}) {
  const visible = React.useMemo(
    () =>
      [...notes]
        .filter((n) => !isActivityNoise(n) && !isChatDuplicate(n))
        .sort(
          (a, b) =>
            (Date.parse(b.createDateTime ?? "") || 0) -
            (Date.parse(a.createDateTime ?? "") || 0),
        ),
    [notes],
  );
  const [open, setOpen] = React.useState(false);

  // Exakt der Rail-Trigger-Look (h-11 Outline-Button) wie „Ticketinformationen"/
  // „Kontext" – KEIN großer Card-Header. Inhalt klappt darunter aus.
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="flex flex-col gap-3"
    >
      <CollapsibleTrigger
        render={
          <Button variant="outline" className="h-11 w-full justify-between" />
        }
      >
        <span className="flex items-center gap-2">
          Aktivität
          {visible.length > 0 && (
            <span className="text-muted-foreground font-normal tabular-nums">
              ({visible.length})
            </span>
          )}
        </span>
        <ChevronDownIcon
          className={cn(
            "text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-3">
        {visible.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Keine relevanten Aktivitäten.
          </p>
        ) : (
          visible.map((note) => (
            <ActivityItem
              key={note.id}
              note={note}
              notePicklists={notePicklists}
            />
          ))
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

// Eine Aktivität: vollständig dargestellt (Badge + Titel + Datum + Text). Kein
// Auf-/Zuklappen mehr – der ganze Bereich klappt als Einheit. Sehr lange Texte
// bleiben über „Mehr anzeigen" (ExpandableText) lesbar.
function ActivityItem({
  note,
  notePicklists,
}: {
  note: TicketNote;
  notePicklists: NotePicklists;
}) {
  const isReply = directionOf(note) === "inbound";
  return (
    <div className="flex flex-col gap-1.5 border-b pb-3 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {isReply ? (
          <Badge className="shrink-0">Kundenantwort</Badge>
        ) : (
          <Badge variant="secondary" className="shrink-0">
            {labelOf(notePicklists.noteType, note.noteType)}
          </Badge>
        )}
        {note.title && (
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {note.title}
          </span>
        )}
        <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">
          {fmtDate(note.createDateTime, true)}
        </span>
      </div>
      {note.description && <ExpandableText text={note.description} />}
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
          <div
            key={e.id}
            className="flex flex-col gap-1 border-b pb-3 last:border-b-0 last:pb-0"
          >
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
