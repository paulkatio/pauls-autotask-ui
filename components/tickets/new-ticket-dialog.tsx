"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronsUpDownIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Picklist, TicketPicklists } from "@/lib/autotask/types";
import type { RefOption } from "@/lib/autotask/entities/contacts";
import { NEW_TICKET_DEFAULT_QUEUE } from "@/lib/autotask/new-ticket";

const UNASSIGNED = "none";
const NONE = "none"; // Sentinel für optionale Picklists (base-ui mag kein value="").

// Default-Picklistwert: bevorzugten Wert (Neu/Mittel) nehmen, sonst ersten Eintrag.
function defaultValue(list: Picklist, preferred: number): string {
  if (list.some((p) => p.value === preferred)) return String(preferred);
  return list[0] ? String(list[0].value) : "";
}

// Standard-Queue (Level I-Support) vorbelegen, falls in der Picklist vorhanden;
// sonst auf das „— Keine"-Sentinel zurückfallen.
function defaultQueue(list: Picklist): string {
  return list.some((q) => q.value === NEW_TICKET_DEFAULT_QUEUE)
    ? String(NEW_TICKET_DEFAULT_QUEUE)
    : NONE;
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor} className="text-sm">
      {children}
    </Label>
  );
}

function SimpleSelect({
  id,
  value,
  items,
  placeholder,
  onChange,
  disabled,
}: {
  id?: string;
  value: string;
  items: { value: string; label: string }[];
  placeholder?: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select items={items} value={value} onValueChange={(v) => onChange(String(v))}>
      <SelectTrigger id={id} className="w-full" disabled={disabled}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function NewTicketDialog({
  picklists,
  prefillCompany,
  triggerLabel,
}: {
  picklists: TicketPicklists;
  // „Neues Ticket für diese Firma" (B3): Firma vorbefüllt, Kontakte gefiltert.
  prefillCompany?: { id: number; name: string };
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  // Firma (Pflicht) – asynchrone Suche wie im Firmenwechsel-Dialog. Optional
  // vorbefüllt aus der Kundenakte.
  const [companyId, setCompanyId] = React.useState<number | null>(
    prefillCompany?.id ?? null,
  );
  const [companyName, setCompanyName] = React.useState(
    prefillCompany?.name ?? "",
  );
  const [companyOpen, setCompanyOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [companyResults, setCompanyResults] = React.useState<
    { id: number; name: string }[]
  >([]);
  const [companyLoading, setCompanyLoading] = React.useState(false);

  // Kontakt (optional) – nach Firma gefiltert, lazy geladen.
  const [contactId, setContactId] = React.useState("");
  const [contactOptions, setContactOptions] = React.useState<RefOption[] | null>(null);
  const [contactOpen, setContactOpen] = React.useState(false);

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [status, setStatus] = React.useState(() =>
    defaultValue(picklists.status, 1),
  );
  const [priority, setPriority] = React.useState(() =>
    defaultValue(picklists.priority, 2),
  );
  const [queue, setQueue] = React.useState(() => defaultQueue(picklists.queue));
  const [issueType, setIssueType] = React.useState(NONE);
  const [subIssueType, setSubIssueType] = React.useState("");

  // Zuweisung (optional, Resource + Rolle gekoppelt). Resourcen beim Öffnen geladen.
  const [resourceId, setResourceId] = React.useState(UNASSIGNED);
  const [resourceOptions, setResourceOptions] = React.useState<
    { id: number; name: string }[] | null
  >(null);
  const [roles, setRoles] = React.useState<{ roleID: number; name: string }[]>([]);
  const [roleId, setRoleId] = React.useState("");

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Firmensuche (debounced).
  React.useEffect(() => {
    if (!companyOpen) return;
    const term = q.trim();
    if (!term) {
      setCompanyResults([]);
      return;
    }
    let active = true;
    setCompanyLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/companies?q=${encodeURIComponent(term)}`, {
          cache: "no-store",
        });
        const j = (await res.json().catch(() => ({}))) as {
          companies?: { id: number; name: string }[];
        };
        if (active) setCompanyResults(j.companies ?? []);
      } catch {
        if (active) setCompanyResults([]);
      } finally {
        if (active) setCompanyLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q, companyOpen]);

  function resetForm() {
    setCompanyId(prefillCompany?.id ?? null);
    setCompanyName(prefillCompany?.name ?? "");
    setQ("");
    setCompanyResults([]);
    setContactId("");
    setContactOptions(null);
    setTitle("");
    setDescription("");
    setStatus(defaultValue(picklists.status, 1));
    setPriority(defaultValue(picklists.priority, 2));
    setQueue(defaultQueue(picklists.queue));
    setIssueType(NONE);
    setSubIssueType("");
    setResourceId(UNASSIGNED);
    setRoles([]);
    setRoleId("");
    setError(null);
  }

  async function loadResources() {
    if (resourceOptions !== null) return;
    try {
      const res = await fetch(`/api/resources`, { cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as {
        resources?: { id: number; name: string }[];
      };
      setResourceOptions(j.resources ?? []);
    } catch {
      setResourceOptions([]);
    }
  }

  async function loadContacts(cid: number) {
    setContactOptions(null);
    try {
      const res = await fetch(`/api/contacts?companyId=${cid}`, {
        cache: "no-store",
      });
      const j = (await res.json().catch(() => ({}))) as { contacts?: RefOption[] };
      setContactOptions(j.contacts ?? []);
    } catch {
      setContactOptions([]);
    }
  }

  async function chooseCompany(c: { id: number; name: string }) {
    setCompanyId(c.id);
    setCompanyName(c.name);
    setCompanyOpen(false);
    // Kontakt zurücksetzen + Kontakte der neuen Firma laden.
    setContactId("");
    await loadContacts(c.id);
  }

  async function changeResource(next: string) {
    setRoles([]);
    setRoleId("");
    setResourceId(next);
    if (next === UNASSIGNED) return;
    try {
      const r = await fetch(`/api/resources/${next}/roles`, { cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as {
        roles?: { roleID: number; name: string }[];
      };
      const rs = j.roles ?? [];
      setRoles(rs);
      if (rs.length === 1) setRoleId(String(rs[0].roleID));
    } catch {
      setRoles([]);
    }
  }

  const subForIssue =
    issueType !== NONE
      ? picklists.subIssueType.filter((s) => s.parentValue === Number(issueType))
      : [];

  const canSubmit = companyId != null && title.trim().length > 0 && !saving;

  // Autotask verlangt beim Anlegen mindestens eine Queue ODER eine vollständige
  // Zuweisung (Resource + Rolle) – verifiziert 2026-06-04 (Fehler „assignedResourceID,
  // assignedResourceRoleID, and queueID cannot all be empty"). Vorab prüfen, damit
  // der Nutzer eine klare deutsche Meldung statt der rohen API-Fehlermeldung sieht.
  const hasAssignment = resourceId !== UNASSIGNED && roleId !== "";
  const needsQueueOrAssignment = queue === NONE && !hasAssignment;

  async function submit() {
    if (companyId == null || !title.trim()) return;
    if (needsQueueOrAssignment) {
      setError(
        "Bitte eine Queue wählen oder das Ticket zuweisen (Autotask verlangt mindestens eines).",
      );
      return;
    }
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      companyID: companyId,
      title: title.trim(),
      status: Number(status),
      priority: Number(priority),
    };
    if (description.trim()) payload.description = description;
    if (contactId) payload.contactID = Number(contactId);
    if (queue !== NONE) payload.queueID = Number(queue);
    if (issueType !== NONE) payload.issueType = Number(issueType);
    if (subIssueType) payload.subIssueType = Number(subIssueType);
    // Zuweisung nur, wenn Resource UND Rolle gewählt sind (gekoppelt).
    if (resourceId !== UNASSIGNED && roleId) {
      payload.assignedResourceID = Number(resourceId);
      payload.assignedResourceRoleID = Number(roleId);
    }

    try {
      const res = await fetch(`/api/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await res.json().catch(() => ({}))) as {
        itemId?: number;
        error?: string;
      };
      if (!res.ok || !j.itemId) {
        throw new Error(j.error ?? "Ticket konnte nicht angelegt werden.");
      }
      toast.success("Ticket angelegt.");
      setOpen(false);
      resetForm();
      router.push(`/tickets/${j.itemId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ticket konnte nicht angelegt werden.");
    } finally {
      setSaving(false);
    }
  }

  const resourceItems = [
    { value: UNASSIGNED, label: "— Nicht zugewiesen" },
    ...(resourceOptions ?? []).map((r) => ({ value: String(r.id), label: r.name })),
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          loadResources();
          if (prefillCompany) loadContacts(prefillCompany.id);
        } else {
          resetForm();
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <PlusIcon />
        {triggerLabel ?? "Neues Ticket"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Neues Ticket</DialogTitle>
          <DialogDescription>
            Firma und Titel sind Pflicht. Weitere Felder sind optional.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-1">
          {/* Firma (Pflicht) */}
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="nt-company">Firma</FieldLabel>
            <Popover open={companyOpen} onOpenChange={setCompanyOpen}>
              <PopoverTrigger
                render={
                  <Button
                    id="nt-company"
                    variant="outline"
                    className="w-full justify-between font-normal"
                  />
                }
              >
                <span className="truncate">
                  {companyName || "Firma suchen …"}
                </span>
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
                    {companyLoading ? (
                      <div className="text-muted-foreground p-3 text-sm">
                        Suchen …
                      </div>
                    ) : (
                      <CommandEmpty>
                        {q.trim() ? "Keine Treffer." : "Firmenname eingeben."}
                      </CommandEmpty>
                    )}
                    <CommandGroup>
                      {companyResults.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={String(c.id)}
                          onSelect={() => chooseCompany(c)}
                        >
                          {c.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Kontakt (optional, nach Firma gefiltert) */}
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="nt-contact">Kontakt (optional)</FieldLabel>
            <Popover open={contactOpen} onOpenChange={setContactOpen}>
              <PopoverTrigger
                render={
                  <Button
                    id="nt-contact"
                    variant="outline"
                    className="w-full justify-between font-normal"
                    disabled={companyId == null}
                  />
                }
              >
                <span className="truncate">
                  {contactId
                    ? (contactOptions?.find((c) => String(c.id) === contactId)
                        ?.label ?? "Kontakt")
                    : companyId == null
                      ? "Erst Firma wählen"
                      : "Kontakt wählen"}
                </span>
                <ChevronsUpDownIcon className="text-muted-foreground" />
              </PopoverTrigger>
              <PopoverContent className="w-(--anchor-width) p-0">
                <Command>
                  <CommandInput placeholder="Kontakt suchen …" />
                  <CommandList>
                    <CommandEmpty>
                      {contactOptions === null ? "Lädt …" : "Keine Kontakte."}
                    </CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__none__"
                        onSelect={() => {
                          setContactId("");
                          setContactOpen(false);
                        }}
                      >
                        — Kein Kontakt
                      </CommandItem>
                      {(contactOptions ?? []).map((c) => (
                        <CommandItem
                          key={c.id}
                          value={c.label}
                          onSelect={() => {
                            setContactId(String(c.id));
                            setContactOpen(false);
                          }}
                        >
                          {c.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Titel (Pflicht) */}
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="nt-title">Titel</FieldLabel>
            <Input
              id="nt-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kurze Zusammenfassung"
              autoFocus
            />
          </div>

          {/* Beschreibung (optional) */}
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="nt-desc">Beschreibung (optional)</FieldLabel>
            <Textarea
              id="nt-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details zum Anliegen"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor="nt-status">Status</FieldLabel>
              <SimpleSelect
                id="nt-status"
                value={status}
                items={picklists.status.map((s) => ({
                  value: String(s.value),
                  label: s.label,
                }))}
                onChange={setStatus}
              />
            </div>
            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor="nt-priority">Priorität</FieldLabel>
              <SimpleSelect
                id="nt-priority"
                value={priority}
                items={picklists.priority.map((p) => ({
                  value: String(p.value),
                  label: p.label,
                }))}
                onChange={setPriority}
              />
            </div>
          </div>

          {/* Queue (optional) */}
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="nt-queue">Queue (optional)</FieldLabel>
            <SimpleSelect
              id="nt-queue"
              value={queue}
              items={[
                { value: NONE, label: "— Keine" },
                ...picklists.queue.map((qq) => ({
                  value: String(qq.value),
                  label: qq.label,
                })),
              ]}
              onChange={setQueue}
            />
            {needsQueueOrAssignment && (
              <p className="text-muted-foreground text-xs">
                Autotask braucht eine Queue oder eine Zuweisung.
              </p>
            )}
          </div>

          {/* Kategorie / Unterkategorie (optional, gekoppelt) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor="nt-issue">Kategorie (optional)</FieldLabel>
              <SimpleSelect
                id="nt-issue"
                value={issueType}
                items={[
                  { value: NONE, label: "— Keine" },
                  ...picklists.issueType.map((o) => ({
                    value: String(o.value),
                    label: o.label,
                  })),
                ]}
                onChange={(v) => {
                  setIssueType(v);
                  setSubIssueType("");
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor="nt-sub">Unterkategorie</FieldLabel>
              <SimpleSelect
                id="nt-sub"
                value={subIssueType}
                items={subForIssue.map((o) => ({
                  value: String(o.value),
                  label: o.label,
                }))}
                placeholder={issueType !== NONE ? "Unterkategorie" : "Erst Kategorie"}
                onChange={setSubIssueType}
                disabled={issueType === NONE || subForIssue.length === 0}
              />
            </div>
          </div>

          {/* Zuweisung (optional, Resource + Rolle gekoppelt) */}
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="nt-resource">Zuweisen an (optional)</FieldLabel>
            <SimpleSelect
              id="nt-resource"
              value={resourceId}
              items={resourceItems}
              onChange={changeResource}
            />
            {resourceId !== UNASSIGNED && roles.length > 1 && (
              <SimpleSelect
                value={roleId}
                items={roles.map((r) => ({
                  value: String(r.roleID),
                  label: r.name,
                }))}
                placeholder="Rolle wählen"
                onChange={setRoleId}
              />
            )}
            {resourceId !== UNASSIGNED && roles.length === 0 && (
              <p className="text-muted-foreground text-xs">
                Diese Resource hat keine Rolle – Zuweisung wird übersprungen.
              </p>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Abbrechen
          </DialogClose>
          <Button onClick={submit} disabled={!canSubmit}>
            {saving ? "Anlegen …" : "Ticket anlegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
