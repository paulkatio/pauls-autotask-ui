"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { XIcon } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { ResourceOption } from "@/lib/autotask/entities/resources";
import type { SecondaryResourceRow } from "@/lib/autotask/entities/ticket-secondary-resources";

// Zusätzliche Mitarbeiter eines Tickets: vorhandene anzeigen (mit Entfernen) und
// neue hinzufügen. Anlegen verlangt eine Rolle (Pflichtfeld) → wie bei der Haupt-
// zuweisung werden die Rollen der Resource geladen: genau eine → direkt anlegen,
// mehrere → zweites Select „Rolle wählen". Nur shadcn-Bausteine + semantische Tokens.
export function SecondaryResourcesEdit({
  ticketId,
  current,
  resources,
  assignedResourceID,
}: {
  ticketId: number;
  current: SecondaryResourceRow[];
  resources: ResourceOption[];
  // Der primäre Verantwortliche kann NICHT zusätzlich sein (Autotask lehnt das ab) →
  // aus der Auswahl ausblenden, damit kein vorhersehbarer Fehler entsteht.
  assignedResourceID?: number | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingResource, setPendingResource] = React.useState<number | null>(null);
  const [roles, setRoles] = React.useState<{ roleID: number; name: string }[]>([]);

  const currentIds = new Set(current.map((c) => c.resourceID));
  const available = resources.filter(
    (r) => !currentIds.has(r.id) && r.id !== assignedResourceID,
  );
  const nameOf = (id: number) =>
    resources.find((r) => r.id === id)?.name ?? `#${id}`;

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

  async function add(resourceID: number, roleID: number) {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/tickets/${ticketId}/secondary-resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceID, roleID }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Hinzufügen fehlgeschlagen.");
      toast.success(`${nameOf(resourceID)} als zusätzlicher Mitarbeiter hinzugefügt.`);
      setRoles([]);
      setPendingResource(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Hinzufügen.");
    } finally {
      setSaving(false);
    }
  }

  async function pickResource(next: string) {
    const rid = Number(next);
    if (!Number.isFinite(rid)) return;
    setError(null);
    setRoles([]);
    setPendingResource(null);
    setSaving(true);
    try {
      const rs = await loadRoles(rid);
      if (rs.length === 0) {
        setError("Diese Resource hat keine Rolle – Hinzufügen nicht möglich.");
      } else if (rs.length === 1) {
        await add(rid, rs[0].roleID);
      } else {
        setRoles(rs);
        setPendingResource(rid);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Laden der Rollen.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number, name: string | null) {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/tickets/${ticketId}/secondary-resources/${id}`,
        { method: "DELETE" },
      );
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Entfernen fehlgeschlagen.");
      toast.success(`${name ?? "Mitarbeiter"} entfernt.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Entfernen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {current.length > 0 && (
        <ul className="flex flex-col gap-1">
          {current.map((sr) => (
            <li
              key={sr.id}
              className="bg-muted/40 flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm"
            >
              <span className="min-w-0 truncate">{sr.name ?? `#${sr.resourceID}`}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 shrink-0 sm:size-7"
                aria-label={`${sr.name ?? "Mitarbeiter"} entfernen`}
                disabled={saving}
                onClick={() => remove(sr.id, sr.name)}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 ? (
        <Select
          items={available.map((r) => ({ value: String(r.id), label: r.name }))}
          value=""
          onValueChange={(v) => pickResource(String(v))}
        >
          <SelectTrigger
            size="sm"
            className="w-full"
            disabled={saving}
            aria-label="Zusätzlichen Mitarbeiter hinzufügen"
          >
            <SelectValue placeholder="+ Mitarbeiter hinzufügen" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {available.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      ) : (
        current.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Keine Mitarbeiter zum Hinzufügen verfügbar.
          </p>
        )
      )}

      {pendingResource != null && roles.length > 1 && (
        <Select
          items={roles.map((r) => ({ value: String(r.roleID), label: r.name }))}
          value=""
          onValueChange={(v) => add(pendingResource, Number(v))}
        >
          <SelectTrigger
            size="sm"
            className="w-full"
            disabled={saving}
            aria-label="Rolle wählen"
          >
            <SelectValue placeholder="Rolle wählen" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {roles.map((r) => (
                <SelectItem key={r.roleID} value={String(r.roleID)}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      )}

      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
