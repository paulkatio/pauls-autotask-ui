"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronsUpDownIcon, PencilIcon } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import type {
  Picklist,
  SubPicklist,
  PicklistEntry,
} from "@/lib/autotask/types";
import type { ResourceOption } from "@/lib/autotask/entities/resources";
import type { RefOption } from "@/lib/autotask/entities/contacts";

const UNASSIGNED = "none";

async function patchTicket(
  ticketId: number,
  data: Record<string, number | null>,
): Promise<void> {
  const res = await fetch(`/api/tickets/${ticketId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(j.error ?? "Speichern fehlgeschlagen.");
}

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-destructive text-xs">{message}</p>;
}

// Beschreibung inline bearbeiten (Schreibpfad: PATCH description als String).
export function DescriptionEdit({
  ticketId,
  value,
}: {
  ticketId: number;
  value: string | null | undefined;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [text, setText] = React.useState(value ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setText(value ?? "");
  }, [value]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: text }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Speichern fehlgeschlagen.");
      toast.success("Beschreibung gespeichert.");
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-col items-start gap-2">
        {value ? (
          <p className="text-sm whitespace-pre-wrap">{value}</p>
        ) : (
          <p className="text-muted-foreground text-sm">
            Keine Beschreibung hinterlegt.
          </p>
        )}
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <PencilIcon />
          Bearbeiten
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        aria-label="Beschreibung"
      />
      <FieldError message={error} />
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Speichern …" : "Speichern"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setText(value ?? "");
            setError(null);
            setEditing(false);
          }}
          disabled={saving}
        >
          Abbrechen
        </Button>
      </div>
    </div>
  );
}

function OptionSelect({
  value,
  options,
  placeholder,
  ariaLabel,
  disabled,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  ariaLabel: string;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <Select items={options} value={value} onValueChange={(v) => onChange(String(v))}>
      <SelectTrigger size="sm" className="w-full" disabled={disabled} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

// Einfaches Picklist-Feld (status/priority/queueID): speichert bei Änderung.
export function TicketFieldSelect({
  ticketId,
  field,
  value,
  options,
  ariaLabel,
}: {
  ticketId: number;
  field: "status" | "priority" | "queueID";
  value: number | null | undefined;
  options: Picklist;
  ariaLabel: string;
}) {
  const router = useRouter();
  const [val, setVal] = React.useState(value == null ? "" : String(value));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setVal(value == null ? "" : String(value));
  }, [value]);

  async function onChange(next: string) {
    if (next === val) return;
    const prev = val;
    setVal(next);
    setSaving(true);
    setError(null);
    try {
      await patchTicket(ticketId, { [field]: Number(next) });
      toast.success("Gespeichert.");
      router.refresh();
    } catch (e) {
      setVal(prev);
      setError(e instanceof Error ? e.message : "Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  const items = options.map((o: PicklistEntry) => ({
    label: o.label,
    value: String(o.value),
  }));
  return (
    <div className="flex flex-col gap-1">
      <OptionSelect
        value={val}
        options={items}
        ariaLabel={ariaLabel}
        disabled={saving}
        onChange={onChange}
      />
      <FieldError message={error} />
    </div>
  );
}

// Kategorie -> Unterkategorie (issueType -> subIssueType, abhängig). issueType
// ändern setzt subIssueType zurück; subIssueType ist nach issueType gefiltert.
export function CategoryEdit({
  ticketId,
  issueType,
  subIssueType,
  issueOptions,
  subOptions,
}: {
  ticketId: number;
  issueType: number | null | undefined;
  subIssueType: number | null | undefined;
  issueOptions: Picklist;
  subOptions: SubPicklist;
}) {
  const router = useRouter();
  const [iss, setIss] = React.useState(issueType == null ? "" : String(issueType));
  const [sub, setSub] = React.useState(
    subIssueType == null ? "" : String(subIssueType),
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setIss(issueType == null ? "" : String(issueType));
    setSub(subIssueType == null ? "" : String(subIssueType));
  }, [issueType, subIssueType]);

  const subForIssue = iss
    ? subOptions.filter((s) => s.parentValue === Number(iss))
    : [];

  async function changeIssue(next: string) {
    if (next === iss) return;
    const prevI = iss;
    const prevS = sub;
    setIss(next);
    setSub(""); // Unterkategorie passt nicht mehr -> leeren
    setSaving(true);
    setError(null);
    try {
      await patchTicket(ticketId, { issueType: Number(next), subIssueType: null });
      toast.success("Gespeichert.");
      router.refresh();
    } catch (e) {
      setIss(prevI);
      setSub(prevS);
      setError(e instanceof Error ? e.message : "Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  async function changeSub(next: string) {
    if (next === sub) return;
    const prev = sub;
    setSub(next);
    setSaving(true);
    setError(null);
    try {
      await patchTicket(ticketId, { subIssueType: Number(next) });
      toast.success("Gespeichert.");
      router.refresh();
    } catch (e) {
      setSub(prev);
      setError(e instanceof Error ? e.message : "Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <OptionSelect
        value={iss}
        options={issueOptions.map((o) => ({ label: o.label, value: String(o.value) }))}
        placeholder="Kategorie"
        ariaLabel="Kategorie"
        disabled={saving}
        onChange={changeIssue}
      />
      <OptionSelect
        value={sub}
        options={subForIssue.map((o) => ({ label: o.label, value: String(o.value) }))}
        placeholder={iss ? "Unterkategorie" : "Erst Kategorie wählen"}
        ariaLabel="Unterkategorie"
        disabled={saving || !iss || subForIssue.length === 0}
        onChange={changeSub}
      />
      <FieldError message={error} />
    </div>
  );
}

// Zuweisung: Resource wählen -> Rolle(n) laden -> beide zusammen senden.
export function AssignmentEdit({
  ticketId,
  assignedResourceID,
  assignedResourceName,
  resources,
}: {
  ticketId: number;
  assignedResourceID: number | null | undefined;
  assignedResourceName?: string | null;
  resources: ResourceOption[];
}) {
  const router = useRouter();
  const [res, setRes] = React.useState(
    assignedResourceID == null ? UNASSIGNED : String(assignedResourceID),
  );
  const [roles, setRoles] = React.useState<{ roleID: number; name: string }[]>([]);
  const [pendingResource, setPendingResource] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setRes(assignedResourceID == null ? UNASSIGNED : String(assignedResourceID));
    setRoles([]);
    setPendingResource(null);
  }, [assignedResourceID]);

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

  async function changeResource(next: string) {
    if (next === res && pendingResource == null) return;
    setError(null);
    setRoles([]);
    setPendingResource(null);

    if (next === UNASSIGNED) {
      const prev = res;
      setRes(UNASSIGNED);
      setSaving(true);
      try {
        await patchTicket(ticketId, {
          assignedResourceID: null,
          assignedResourceRoleID: null,
        });
        toast.success("Zuweisung entfernt.");
        router.refresh();
      } catch (e) {
        setRes(prev);
        setError(e instanceof Error ? e.message : "Fehler beim Speichern.");
      } finally {
        setSaving(false);
      }
      return;
    }

    const rid = Number(next);
    setRes(next);
    setSaving(true);
    try {
      const rs = await loadRoles(rid);
      if (rs.length === 0) {
        setError("Diese Resource hat keine Rolle – Zuweisung nicht möglich.");
      } else if (rs.length === 1) {
        await patchTicket(ticketId, {
          assignedResourceID: rid,
          assignedResourceRoleID: rs[0].roleID,
        });
        toast.success("Zugewiesen.");
        router.refresh();
      } else {
        // Mehrere Rollen -> zweites Select anzeigen, noch nicht speichern.
        setRoles(rs);
        setPendingResource(rid);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  async function chooseRole(next: string) {
    if (pendingResource == null) return;
    setSaving(true);
    setError(null);
    try {
      await patchTicket(ticketId, {
        assignedResourceID: pendingResource,
        assignedResourceRoleID: Number(next),
      });
      toast.success("Zugewiesen.");
      setRoles([]);
      setPendingResource(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  const resourceItems = [
    { value: UNASSIGNED, label: "— Nicht zugewiesen" },
    ...resources.map((r) => ({ value: String(r.id), label: r.name })),
  ];
  // Aktuell zugewiesene Resource ergänzen, falls sie nicht in der Aktiv-Liste
  // steht (sonst zeigt das Select nur die ID statt des Namens).
  if (
    assignedResourceID != null &&
    !resources.some((r) => r.id === assignedResourceID)
  ) {
    resourceItems.push({
      value: String(assignedResourceID),
      label: assignedResourceName || `#${assignedResourceID}`,
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <OptionSelect
        value={res}
        options={resourceItems}
        ariaLabel="Zugewiesen"
        disabled={saving}
        onChange={changeResource}
      />
      {pendingResource != null && roles.length > 1 && (
        <OptionSelect
          value=""
          options={roles.map((r) => ({ value: String(r.roleID), label: r.name }))}
          placeholder="Rolle wählen"
          ariaLabel="Rolle"
          disabled={saving}
          onChange={chooseRole}
        />
      )}
      <FieldError message={error} />
    </div>
  );
}

// Suchbare Referenz-Combobox (Kontakt/Gerät/Vertrag), firmengefiltert. Optionen
// sind serverseitig nach der companyID des Tickets vorgefiltert. Speichert bei Wahl.
export function RefCombobox({
  ticketId,
  field,
  valueLabel,
  options,
  placeholder,
}: {
  ticketId: number;
  field: "contactID" | "configurationItemID" | "contractID";
  valueLabel: string | null;
  options: RefOption[];
  placeholder: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [label, setLabel] = React.useState(valueLabel);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLabel(valueLabel);
  }, [valueLabel]);

  async function choose(id: number | null, lbl: string | null) {
    setOpen(false);
    const prev = label;
    setLabel(lbl);
    setSaving(true);
    setError(null);
    try {
      await patchTicket(ticketId, { [field]: id });
      toast.success("Gespeichert.");
      router.refresh();
    } catch (e) {
      setLabel(prev);
      setError(e instanceof Error ? e.message : "Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between font-normal"
              disabled={saving}
            />
          }
        >
          <span className="truncate">{label ?? placeholder}</span>
          <ChevronsUpDownIcon className="text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0">
          <Command>
            <CommandInput placeholder="Suchen …" />
            <CommandList>
              <CommandEmpty>Keine Treffer.</CommandEmpty>
              <CommandGroup>
                <CommandItem value="__none__" onSelect={() => choose(null, null)}>
                  — Keine
                </CommandItem>
                {options.map((o) => (
                  <CommandItem
                    key={o.id}
                    value={o.label}
                    onSelect={() => choose(o.id, o.label)}
                  >
                    {o.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <FieldError message={error} />
    </div>
  );
}

// Firmenwechsel als bewusste Aktion (Dialog). Autotask kaskadiert NICHT: beim
// companyID-Wechsel müssen Kontakt/Gerät/Vertrag im SELBEN PATCH genullt werden,
// sonst lehnt Autotask den ganzen PATCH ab (DECISIONS 2026-06-03).
export function CompanyChange({
  ticketId,
  currentName,
}: {
  ticketId: number;
  currentName: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<{ id: number; name: string } | null>(
    null,
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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

  async function confirm() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      // companyID neu + ALLE firmengebundenen Abhängigen im selben PATCH nullen
      // (keine Auto-Kaskade). companyLocationID gehört ebenfalls zur alten Firma
      // und muss mit zurückgesetzt werden (sonst lehnt Autotask den PATCH ab).
      await patchTicket(ticketId, {
        companyID: selected.id,
        contactID: null,
        configurationItemID: null,
        contractID: null,
        companyLocationID: null,
      });
      toast.success("Firma geändert. Kontakt/Gerät/Vertrag wurden zurückgesetzt.");
      setOpen(false);
      setSelected(null);
      setQ("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Firma ändern
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Firma ändern</DialogTitle>
          <DialogDescription>
            Aktuell: {currentName ?? "—"}. Beim Wechsel werden Kontakt, Gerät und
            Vertrag zurückgesetzt (Autotask kaskadiert nicht).
          </DialogDescription>
        </DialogHeader>

        <Command shouldFilter={false}>
          <CommandInput
            value={q}
            onValueChange={setQ}
            placeholder="Firma suchen …"
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
              {results.map((c) => (
                <CommandItem
                  key={c.id}
                  value={String(c.id)}
                  onSelect={() => setSelected(c)}
                >
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>

        {selected && (
          <p className="text-sm">
            Neue Firma:{" "}
            <span className="font-medium">{selected.name}</span>
          </p>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Abbrechen
          </DialogClose>
          <Button onClick={confirm} disabled={!selected || saving}>
            {saving ? "Speichern …" : "Firma ändern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
