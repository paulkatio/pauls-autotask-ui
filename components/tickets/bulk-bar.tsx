"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  MergeIcon,
  Undo2Icon,
  UserPlusIcon,
  XIcon,
} from "lucide-react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TicketPicklists } from "@/lib/autotask/types";
import type { ResourceOption } from "@/lib/autotask/entities/resources";
import { recordHistory } from "@/lib/history";

// Bulk-Aktionen für die ausgewählten Tickets. KEIN neuer Schreibpfad: pro Ticket
// das bestehende PATCH /api/tickets/[id] (Whitelist). Ausführung mit Limiter
// (max. 3 parallel), Teilfehler werden gesammelt statt abzubrechen. Vor jeder
// Aktion werden die alten Feldwerte geschnappschusst, damit die Aktion über
// „Rückgängig" wieder zurückgesetzt werden kann (Undo der letzten Aktion).
const MAX_PARALLEL = 3;

// „Mir zuweisen" nutzt immer diese Rolle (keine Rollen-Abfrage), sofern die Resource
// sie hält – sonst Fallback auf die einzige/erste Rolle.
const PREFERRED_SELF_ROLE = "Netzwerkadministrator";

type FieldKey =
  | "status"
  | "priority"
  | "queueID"
  | "assignedResourceID"
  | "assignedResourceRoleID";

interface SelectedTicket {
  id: number;
  ticketNumber: string;
  status?: number;
  priority?: number;
  queueID?: number | null;
  assignedResourceID?: number | null;
  assignedResourceRoleID?: number | null;
  companyID?: number | null;
  title?: string | null;
}

interface Pending {
  body: Record<string, number>;
  fields: FieldKey[];
  verb: string;
}

type Phase = "confirm" | "running" | "result";

interface RunResult {
  id: number;
  ticketNumber: string;
  ok: boolean;
  error?: string;
}

interface ReverseOp {
  id: number;
  ticketNumber: string;
  body: Record<string, number | null>;
}

// Ergebnis der Zusammenführung (B26, „Link & Close").
interface MergeSourceResult {
  id: number;
  ticketNumber: string;
  ok: boolean;
  error?: string;
}
interface MergeOutcome {
  targetTicketNumber: string;
  targetNoteCreated: boolean;
  sources: MergeSourceResult[];
}

async function loadRoles(
  resourceId: number,
): Promise<{ roleID: number; name: string }[]> {
  const r = await fetch(`/api/resources/${resourceId}/roles`, {
    cache: "no-store",
  });
  const j = (await r.json().catch(() => ({}))) as {
    roles?: { roleID: number; name: string }[];
    error?: string;
  };
  if (!r.ok) throw new Error(j.error ?? "Rollen konnten nicht geladen werden.");
  return j.roles ?? [];
}

async function patchTicket(
  id: number,
  body: Record<string, number | null>,
): Promise<void> {
  const res = await fetch(`/api/tickets/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(j.error ?? `Fehler (${res.status}).`);
}

// Limiter: höchstens `limit` PATCHes gleichzeitig; jeder Abschluss meldet Fortschritt.
async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let idx = 0;
  async function next(): Promise<void> {
    const i = idx++;
    if (i >= items.length) return;
    await worker(items[i]);
    await next();
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => next()),
  );
}

// Rückgängig-Ausführung der zuletzt geänderten Tickets. Bewusst eigenständig
// (kein Komponenten-State), damit „Rückgängig" auch aus dem Toast noch funktioniert,
// wenn die Bulk-Leiste längst wieder ausgeblendet ist.
async function undoBatch(ops: ReverseOp[], refresh: () => void): Promise<void> {
  if (ops.length === 0) return;
  const toastId = toast.loading(`Rückgängig … 0/${ops.length}`);
  let done = 0;
  let ok = 0;
  const failed: string[] = [];
  await runPool(ops, MAX_PARALLEL, async (op) => {
    try {
      await patchTicket(op.id, op.body);
      ok++;
    } catch {
      failed.push(op.ticketNumber);
    } finally {
      done++;
      toast.loading(`Rückgängig … ${done}/${ops.length}`, { id: toastId });
    }
  });
  if (failed.length === 0) {
    toast.success(`Rückgängig: ${ok} Tickets wiederhergestellt.`, { id: toastId });
  } else {
    toast.warning(
      `Rückgängig: ${ok} wiederhergestellt, ${failed.length} fehlgeschlagen.`,
      { id: toastId },
    );
  }
  refresh();
}

// Reverse-Body aus den geschnappschussten Altwerten. Zuweisung immer gekoppelt
// (Resource + Rolle zusammen, fehlende Werte als null).
function buildReverse(t: SelectedTicket, fields: FieldKey[]): ReverseOp {
  const body: Record<string, number | null> = {};
  if (fields.includes("assignedResourceID")) {
    body.assignedResourceID = t.assignedResourceID ?? null;
    body.assignedResourceRoleID = t.assignedResourceRoleID ?? null;
  }
  for (const f of fields) {
    if (f === "assignedResourceID" || f === "assignedResourceRoleID") continue;
    const v = t[f];
    if (v !== undefined && v !== null) body[f] = v;
  }
  return { id: t.id, ticketNumber: t.ticketNumber, body };
}

export function BulkBar({
  selected,
  picklists,
  resources,
  myResourceId,
  onClearSelection,
  onApplied,
}: {
  selected: SelectedTicket[];
  picklists: TicketPicklists;
  resources: ResourceOption[];
  myResourceId: number;
  onClearSelection: () => void;
  onApplied: () => void;
}) {
  const count = selected.length;

  const [assignOpen, setAssignOpen] = React.useState(false);
  const [roleStep, setRoleStep] = React.useState<{
    body: Record<string, number>;
    label: string;
    roles: { roleID: number; name: string }[];
  } | null>(null);
  const [busyRoles, setBusyRoles] = React.useState(false);

  const [pending, setPending] = React.useState<Pending | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>("confirm");
  const [done, setDone] = React.useState(0);
  const [results, setResults] = React.useState<RunResult[]>([]);
  const [undoOps, setUndoOps] = React.useState<ReverseOp[]>([]);

  // Zusammenführen (B26): nur aktiv, wenn alle Ausgewählten dieselbe Firma haben.
  const companyIds = new Set(selected.map((t) => t.companyID ?? null));
  const sameCompany =
    selected.length >= 1 && companyIds.size === 1 && !companyIds.has(null);
  const [mergeOpen, setMergeOpen] = React.useState(false);
  const [mergePhase, setMergePhase] = React.useState<"pick" | "running" | "result">(
    "pick",
  );
  const [mergeTargetId, setMergeTargetId] = React.useState<number | null>(null);
  const [mergeOutcome, setMergeOutcome] = React.useState<MergeOutcome | null>(null);
  const [companyTickets, setCompanyTickets] = React.useState<
    { id: number; ticketNumber: string; title: string; status?: number }[]
  >([]);
  const [mergeSearch, setMergeSearch] = React.useState("");
  const [loadingTickets, setLoadingTickets] = React.useState(false);
  const mergeCompanyId = selected[0]?.companyID ?? null;

  // Ziel-Picker: Tickets der Firma laden (debounced; beim Öffnen + bei Suche).
  React.useEffect(() => {
    if (!mergeOpen || mergePhase !== "pick" || mergeCompanyId == null) return;
    let cancelled = false;
    setLoadingTickets(true);
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ companyId: String(mergeCompanyId) });
        if (mergeSearch.trim()) params.set("q", mergeSearch.trim());
        const r = await fetch(`/api/tickets/by-company?${params.toString()}`, {
          cache: "no-store",
        });
        const j = (await r.json().catch(() => ({}))) as {
          tickets?: { id: number; ticketNumber: string; title: string; status?: number }[];
        };
        if (!cancelled) setCompanyTickets(r.ok ? (j.tickets ?? []) : []);
      } catch {
        if (!cancelled) setCompanyTickets([]);
      } finally {
        if (!cancelled) setLoadingTickets(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [mergeOpen, mergePhase, mergeSearch, mergeCompanyId]);

  function startConfirm(p: Pending) {
    setPending(p);
    setPhase("confirm");
    setDone(0);
    setResults([]);
    setDialogOpen(true);
  }

  // Status / Priorität / Queue: direkte Bestätigung.
  function pickStatus(value: string) {
    const s = picklists.status.find((o) => String(o.value) === value);
    if (!s) return;
    startConfirm({
      body: { status: s.value },
      fields: ["status"],
      verb: `auf „${s.label}" setzen`,
    });
  }
  function pickPriority(value: string) {
    const p = picklists.priority.find((o) => String(o.value) === value);
    if (!p) return;
    startConfirm({
      body: { priority: p.value },
      fields: ["priority"],
      verb: `auf Priorität „${p.label}" setzen`,
    });
  }
  function pickQueue(value: string) {
    const q = picklists.queue.find((o) => String(o.value) === value);
    if (!q) return;
    startConfirm({
      body: { queueID: q.value },
      fields: ["queueID"],
      verb: `in die Queue „${q.label}" verschieben`,
    });
  }

  // Zuweisung: Resource -> Rolle(n) laden -> gekoppelt senden (wie B15b).
  async function pickResource(resourceId: number, label: string) {
    setBusyRoles(true);
    try {
      const roles = await loadRoles(resourceId);
      if (roles.length === 0) {
        toast.error("Diese Resource hat keine Rolle – Zuweisung nicht möglich.");
        return;
      }
      if (roles.length === 1) {
        setAssignOpen(false);
        startConfirm({
          body: {
            assignedResourceID: resourceId,
            assignedResourceRoleID: roles[0].roleID,
          },
          fields: ["assignedResourceID", "assignedResourceRoleID"],
          verb: `${label} zuweisen`,
        });
      } else {
        // Mehrere Rollen -> Rollen-Auswahl im Popover zeigen (auch wenn die
        // Auswahl über „Mir zuweisen" kam, dessen Button kein eigenes Popover hat).
        setRoleStep({
          body: { assignedResourceID: resourceId },
          label,
          roles,
        });
        setAssignOpen(true);
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Rollen konnten nicht geladen werden.",
      );
    } finally {
      setBusyRoles(false);
    }
  }

  function pickRole(roleID: number) {
    if (!roleStep) return;
    const step = roleStep;
    setAssignOpen(false);
    setRoleStep(null);
    startConfirm({
      body: { ...step.body, assignedResourceRoleID: roleID },
      fields: ["assignedResourceID", "assignedResourceRoleID"],
      verb: `${step.label} zuweisen`,
    });
  }

  // „Mir zuweisen": KEINE Rollenfrage. Immer Rolle „Netzwerkadministrator" (falls
  // vorhanden), sonst die einzige/erste Rolle. Danach normale Bestätigung (mit
  // Ticket-Liste im Dialog).
  async function assignToMe() {
    setBusyRoles(true);
    try {
      const roles = await loadRoles(myResourceId);
      if (roles.length === 0) {
        toast.error("Du hast keine Rolle – Zuweisung nicht möglich.");
        return;
      }
      const role =
        roles.find((r) => r.name === PREFERRED_SELF_ROLE) ??
        roles.find((r) => /netzwerkadmin/i.test(r.name)) ??
        roles[0];
      startConfirm({
        body: {
          assignedResourceID: myResourceId,
          assignedResourceRoleID: role.roleID,
        },
        fields: ["assignedResourceID", "assignedResourceRoleID"],
        verb: "dir zuweisen",
      });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Rollen konnten nicht geladen werden.",
      );
    } finally {
      setBusyRoles(false);
    }
  }

  async function run() {
    if (!pending) return;
    const p = pending;
    setPhase("running");
    setDone(0);
    const acc: RunResult[] = [];
    await runPool(selected, MAX_PARALLEL, async (t) => {
      try {
        await patchTicket(t.id, p.body);
        acc.push({ id: t.id, ticketNumber: t.ticketNumber, ok: true });
      } catch (e) {
        acc.push({
          id: t.id,
          ticketNumber: t.ticketNumber,
          ok: false,
          error: e instanceof Error ? e.message : "Fehler.",
        });
      } finally {
        setDone((d) => d + 1);
      }
    });

    // Undo-Operationen nur für die tatsächlich geänderten Tickets.
    const reverse: ReverseOp[] = acc
      .filter((r) => r.ok)
      .map((r) => {
        const t = selected.find((x) => x.id === r.id)!;
        return buildReverse(t, p.fields);
      })
      .filter((op) => Object.keys(op.body).length > 0);

    const okCount = acc.filter((r) => r.ok).length;
    const failedCount = acc.length - okCount;
    // In den globalen Verlauf eintragen (rückgängig über das Verlauf-Sheet im Header).
    if (reverse.length > 0) {
      recordHistory({
        label: `${okCount} Ticket(s): ${p.verb}`,
        reversible: true,
        reverse,
      });
    }
    setResults(acc);
    setUndoOps(reverse);
    setPhase("result");

    const action =
      reverse.length > 0
        ? {
            label: "Rückgängig",
            onClick: () => undoBatch(reverse, onApplied),
          }
        : undefined;
    if (failedCount === 0) {
      toast.success(`${okCount} Tickets aktualisiert.`, { action, duration: 8000 });
    } else {
      toast.warning(`${okCount} erfolgreich, ${failedCount} fehlgeschlagen.`, {
        action,
        duration: 8000,
      });
    }
  }

  // Ergebnis-Dialog schließen: bei Erfolgen aktualisieren + Auswahl leeren.
  function closeResult() {
    const anyOk = results.some((r) => r.ok);
    setDialogOpen(false);
    setPending(null);
    if (anyOk) onApplied();
  }

  function undoFromDialog() {
    const ops = undoOps;
    setDialogOpen(false);
    setPending(null);
    undoBatch(ops, onApplied);
  }

  // --- Zusammenführen (B26, „Link & Close") ---
  function openMerge() {
    if (!sameCompany) return;
    setMergeTargetId(null);
    setMergeSearch("");
    setCompanyTickets([]);
    setMergeOutcome(null);
    setMergePhase("pick");
    setMergeOpen(true);
  }

  async function runMerge() {
    if (mergeTargetId == null) {
      toast.error("Bitte ein Ziel-Ticket wählen.");
      return;
    }
    const sourceIds = selected
      .map((t) => t.id)
      .filter((id) => id !== mergeTargetId);
    if (sourceIds.length === 0) {
      toast.error("Markiere weitere Tickets oder wähle ein anderes Ziel.");
      return;
    }
    setMergePhase("running");
    try {
      const res = await fetch("/api/tickets/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: mergeTargetId, sourceIds }),
      });
      const j = (await res.json().catch(() => ({}))) as MergeOutcome & {
        error?: string;
      };
      if (!res.ok) throw new Error(j.error ?? "Zusammenführen fehlgeschlagen.");
      setMergeOutcome(j);
      setMergePhase("result");
      const okSources = (j.sources ?? []).filter((s) => s.ok).length;
      if (okSources > 0) {
        // Merge ist nicht automatisch rückgängig (Notizen bleiben) -> nur Log-Eintrag.
        recordHistory({
          label: `Zusammengeführt in ${j.targetTicketNumber} (${okSources} Quellticket(s))`,
          reversible: false,
        });
      }
      const failed = (j.sources ?? []).filter((s) => !s.ok).length;
      if (failed === 0) toast.success(`In ${j.targetTicketNumber} zusammengeführt.`);
      else
        toast.warning(
          `Zusammengeführt – ${failed} Quellticket(s) fehlgeschlagen.`,
        );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Zusammenführen fehlgeschlagen.",
      );
      setMergeOpen(false);
      setMergePhase("pick");
    }
  }

  function closeMerge() {
    const anyOk =
      mergeOutcome != null &&
      (mergeOutcome.targetNoteCreated || mergeOutcome.sources.some((s) => s.ok));
    setMergeOpen(false);
    setMergePhase("pick");
    setMergeOutcome(null);
    if (anyOk) onApplied();
  }

  const statusItems = picklists.status.map((s) => ({
    label: s.label,
    value: String(s.value),
  }));
  const priorityItems = picklists.priority.map((p) => ({
    label: p.label,
    value: String(p.value),
  }));
  const queueItems = picklists.queue.map((q) => ({
    label: q.label,
    value: String(q.value),
  }));

  const failedResults = results.filter((r) => !r.ok);
  const okCount = results.length - failedResults.length;

  return (
    <>
      {/* Inline-Leiste: ersetzt die Filterzeile an Ort und Stelle. Die Höhe des
          Slots wird in TicketsList konstant gehalten (Filter + Leiste gestapelt),
          damit beim Markieren nichts springt. */}
      <div className="flex w-full flex-wrap items-center gap-2">
        <span className="text-sm font-medium whitespace-nowrap">
          {count} {count === 1 ? "Ticket" : "Tickets"} ausgewählt
        </span>

          <Select items={statusItems} value="" onValueChange={(v) => pickStatus(String(v))}>
            <SelectTrigger size="sm" className="w-auto min-w-36">
              <SelectValue placeholder="Status ändern" />
            </SelectTrigger>
            <SelectContent className="w-auto min-w-52">
              <SelectGroup>
                {statusItems.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select items={priorityItems} value="" onValueChange={(v) => pickPriority(String(v))}>
            <SelectTrigger size="sm" className="w-auto min-w-36">
              <SelectValue placeholder="Priorität ändern" />
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

          <Select items={queueItems} value="" onValueChange={(v) => pickQueue(String(v))}>
            <SelectTrigger size="sm" className="w-auto min-w-36">
              <SelectValue placeholder="Queue ändern" />
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

          <Popover
            open={assignOpen}
            onOpenChange={(o) => {
              setAssignOpen(o);
              if (!o) setRoleStep(null);
            }}
          >
            <PopoverTrigger
              render={<Button variant="outline" size="sm" disabled={busyRoles} />}
            >
              Zuweisen
              <ChevronsUpDownIcon className="text-muted-foreground" />
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0">
              {roleStep ? (
                <Command>
                  <CommandList>
                    <CommandGroup heading="Rolle wählen">
                      {roleStep.roles.map((r) => (
                        <CommandItem
                          key={r.roleID}
                          value={r.name}
                          onSelect={() => pickRole(r.roleID)}
                        >
                          {r.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              ) : (
                <Command>
                  <CommandInput placeholder="Mitarbeiter suchen …" />
                  <CommandList>
                    <CommandEmpty>Keine Treffer.</CommandEmpty>
                    <CommandGroup>
                      {resources.map((r) => (
                        <CommandItem
                          key={r.id}
                          value={r.name}
                          onSelect={() => pickResource(r.id, r.name)}
                        >
                          {r.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              )}
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="sm"
            disabled={busyRoles}
            onClick={assignToMe}
          >
            <UserPlusIcon />
            Mir zuweisen
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={!sameCompany}
            title={
              sameCompany
                ? undefined
                : "Zusammenführen nur bei mehreren Tickets derselben Firma"
            }
            onClick={openMerge}
          >
            <MergeIcon />
            Zusammenführen
          </Button>

          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            <XIcon />
            Auswahl aufheben
          </Button>
      </div>

      <AlertDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          // Während der Ausführung nicht schließbar.
          if (phase === "running") return;
          if (!o) {
            if (phase === "result") closeResult();
            else {
              setDialogOpen(false);
              setPending(null);
            }
          }
        }}
      >
        <AlertDialogContent>
          {phase === "confirm" && pending && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Aktion bestätigen</AlertDialogTitle>
                <AlertDialogDescription>
                  {count} {count === 1 ? "Ticket" : "Tickets"} {pending.verb}?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <ScrollArea className="max-h-40 rounded-md border">
                <ul className="flex flex-col p-1">
                  {selected.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center gap-2 px-2 py-1 text-sm"
                    >
                      <span className="font-medium tabular-nums">
                        {t.ticketNumber}
                      </span>
                      <span className="text-muted-foreground truncate">
                        {t.title ?? ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={run}>Ausführen</AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}

          {phase === "running" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Wird ausgeführt …</AlertDialogTitle>
                <AlertDialogDescription>
                  {done}/{count} Tickets verarbeitet.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Progress value={count ? (done / count) * 100 : 0} />
            </>
          )}

          {phase === "result" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Ergebnis</AlertDialogTitle>
                <AlertDialogDescription>
                  {okCount} erfolgreich
                  {failedResults.length > 0
                    ? `, ${failedResults.length} fehlgeschlagen`
                    : ""}
                  .
                </AlertDialogDescription>
              </AlertDialogHeader>
              {failedResults.length > 0 && (
                <Alert variant="destructive">
                  <AlertTitle>Fehlgeschlagene Tickets</AlertTitle>
                  <AlertDescription>
                    <ul className="flex flex-col gap-1">
                      {failedResults.map((r) => (
                        <li key={r.ticketNumber}>
                          <span className="font-medium tabular-nums">
                            {r.ticketNumber}
                          </span>
                          {": "}
                          {r.error}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              <AlertDialogFooter>
                {undoOps.length > 0 && (
                  <Button variant="outline" onClick={undoFromDialog}>
                    <Undo2Icon />
                    Rückgängig
                  </Button>
                )}
                <AlertDialogAction onClick={closeResult}>
                  Schließen
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* Zusammenführen (B26, „Link & Close") – eigener Dialog: Ziel wählen → bestätigen. */}
      <AlertDialog
        open={mergeOpen}
        onOpenChange={(o) => {
          if (mergePhase === "running") return;
          if (!o) {
            if (mergePhase === "result") closeMerge();
            else setMergeOpen(false);
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-xl!">
          {mergePhase === "pick" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Tickets zusammenführen</AlertDialogTitle>
                <AlertDialogDescription>
                  Die {count} markierten Tickets werden in das gewählte Ziel-Ticket
                  zusammengeführt — wie bei Autotask: die markierten werden auf
                  „Abgeschlossen" gesetzt, ihr Titel + Beschreibung landen als Notiz im
                  Ziel. Das Ziel-Ticket ändert seinen Status NICHT. Ziel aus den Tickets
                  dieser Firma wählen.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex min-w-0 flex-col gap-2">
                <span className="text-sm font-medium">Ziel-Ticket (dieser Firma)</span>
                <Input
                  value={mergeSearch}
                  onChange={(e) => setMergeSearch(e.target.value)}
                  placeholder="Ticket der Firma suchen (Nummer/Titel) …"
                  aria-label="Ziel-Ticket suchen"
                />
                <ScrollArea className="h-56 rounded-md border">
                  <div className="flex flex-col">
                    {loadingTickets ? (
                      <span className="text-muted-foreground p-3 text-sm">Lädt …</span>
                    ) : companyTickets.length === 0 ? (
                      <span className="text-muted-foreground p-3 text-sm">
                        Keine Tickets gefunden.
                      </span>
                    ) : (
                      companyTickets.map((t) => {
                        const isSel = t.id === mergeTargetId;
                        const isSource = selected.some((s) => s.id === t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setMergeTargetId(t.id)}
                            className={cn(
                              "hover:bg-accent flex w-full min-w-0 items-center justify-between gap-2 px-3 py-2 text-left text-sm",
                              isSel && "bg-accent",
                            )}
                          >
                            <span className="flex min-w-0 flex-col">
                              <span className="font-medium tabular-nums">
                                {t.ticketNumber}
                              </span>
                              <span className="text-muted-foreground truncate">
                                {t.title || "—"}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              {isSource && <Badge variant="outline">markiert</Badge>}
                              {isSel && <CheckIcon className="size-4" />}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
                <span className="text-muted-foreground text-xs">
                  {mergeTargetId == null
                    ? "Bitte Ziel-Ticket wählen."
                    : `${selected.filter((s) => s.id !== mergeTargetId).length} markierte(s) Ticket(s) werden zusammengeführt.`}
                </span>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={runMerge}>
                  Zusammenführen
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}

          {mergePhase === "running" && (
            <AlertDialogHeader>
              <AlertDialogTitle>Wird zusammengeführt …</AlertDialogTitle>
              <AlertDialogDescription>
                Quelltickets werden verlinkt und geschlossen.
              </AlertDialogDescription>
            </AlertDialogHeader>
          )}

          {mergePhase === "result" && mergeOutcome && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Zusammengeführt</AlertDialogTitle>
                <AlertDialogDescription>
                  Ziel: {mergeOutcome.targetTicketNumber}.{" "}
                  {mergeOutcome.sources.filter((s) => s.ok).length} von{" "}
                  {mergeOutcome.sources.length} Quelltickets abgeschlossen + übernommen.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {mergeOutcome.sources.some((s) => !s.ok) && (
                <Alert variant="destructive">
                  <AlertTitle>Fehlgeschlagene Quelltickets</AlertTitle>
                  <AlertDescription>
                    <ul className="flex flex-col gap-1">
                      {mergeOutcome.sources
                        .filter((s) => !s.ok)
                        .map((s) => (
                          <li key={s.id}>
                            <span className="font-medium tabular-nums">
                              {s.ticketNumber}
                            </span>
                            {": "}
                            {s.error}
                          </li>
                        ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              <AlertDialogFooter>
                <AlertDialogAction onClick={closeMerge}>Schließen</AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
