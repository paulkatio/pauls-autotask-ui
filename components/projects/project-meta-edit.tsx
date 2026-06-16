"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { recordHistory } from "@/lib/history";
import { saveToast } from "@/lib/ui/save-toast";
import type { ResourceOption } from "@/lib/autotask/entities/resources";
import type { Project } from "@/lib/autotask/types";

// Inline-Bearbeitung der Projekt-Kernfelder. EDITIERBAR sind nur die gegen die Sandbox
// als schreibbar verifizierten Felder (DECISIONS.md 2026-06-12): Projektleiter und
// Fällig (endDateTime). Status, Fortschritt, Start und Typ stehen read-only daneben,
// weil sie per API NICHT änderbar sind (Status = No-Op, Fortschritt = berechnet,
// Start = bei vorhandenen Aufgaben/Phasen gesperrt).
// Schreibpfad: PATCH /api/projects/{id} (server-seitiger Guard PROJECT_WRITES_ENABLED).
// Jede Änderung wird optimistisch gespeichert, per Toast quittiert und mit Alt-Wert in
// den globalen Verlauf eingetragen (entity-aware → Undo trifft /api/projects, nicht
// /api/tickets). `apiPath` + `label` sorgen für die korrekte Rücksetzung.

const NONE = "none";

async function patchProject(
  id: number,
  data: Record<string, number | string | null>,
): Promise<void> {
  const res = await fetch(`/api/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(j.error ?? "Speichern fehlgeschlagen.");
}

// YYYY-MM-DD direkt aus dem ISO-String schneiden – KEIN `new Date(...).toISOString()`,
// das in Zeitzonen östlich/westlich von UTC um einen Tag kippen kann (Berlin:
// `new Date("2026-12-20T00:00:00").toISOString()` → 2026-12-19).
function isoToDateInput(iso?: string | null): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

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

function formatPercent(n?: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n)} %`;
}

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-destructive text-xs">{message}</p>;
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-1 sm:grid-cols-[8rem_1fr] sm:gap-3">
      <span className="text-muted-foreground text-sm">{label}</span>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

export function ProjectMetaEdit({
  project,
  projectName,
  resources,
  statusLabel,
  typeLabel,
}: {
  project: Project;
  projectName: string;
  resources: ResourceOption[];
  statusLabel: string | null;
  typeLabel: string | null;
}) {
  const id = project.id;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Projektdaten</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Editierbar (verifiziert schreibbar). */}
        <Row label="Projektleiter">
          <SelectField
            id={id}
            projectName={projectName}
            field="projectLeadResourceID"
            current={project.projectLeadResourceID ?? null}
            options={resources.map((r) => ({
              value: String(r.id),
              label: r.name,
            }))}
            successLabel="Projektleiter"
            allowNone
            noneLabel="Kein Leiter"
          />
        </Row>

        <Row label="Fällig">
          <DateField
            id={id}
            projectName={projectName}
            field="endDateTime"
            current={project.endDateTime ?? null}
            successLabel="Fälligkeitsdatum"
          />
        </Row>

        {/* Read-only (per API nicht änderbar – s. Kommentar oben). */}
        <Row label="Status">
          <span className="text-sm">{statusLabel ?? "—"}</span>
        </Row>
        <Row label="Start">
          <span className="text-sm tabular-nums">
            {formatDate(project.startDateTime)}
          </span>
        </Row>
        <Row label="Fortschritt">
          <span className="text-sm tabular-nums">
            {formatPercent(project.completedPercentage)}
          </span>
        </Row>
        <Row label="Typ">
          <span className="text-sm">{typeLabel ?? "—"}</span>
        </Row>
      </CardContent>
    </Card>
  );
}

// Picklist-/Referenz-Feld (Status, Projektleiter). Speichert bei Auswahländerung.
function SelectField({
  id,
  projectName,
  field,
  current,
  options,
  successLabel,
  allowNone = false,
  noneLabel,
}: {
  id: number;
  projectName: string;
  field: "projectLeadResourceID";
  current: number | null;
  options: { value: string; label: string }[];
  successLabel: string;
  allowNone?: boolean;
  noneLabel?: string;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(current != null ? String(current) : NONE);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Server-Wert ändert sich -> Auswahl angleichen (Render-Muster, kein Effect).
  const [prevCurrent, setPrevCurrent] = React.useState(current);
  if (current !== prevCurrent) {
    setPrevCurrent(current);
    setValue(current != null ? String(current) : NONE);
  }

  async function onChange(next: string) {
    const prev = value;
    setValue(next);
    setSaving(true);
    setError(null);
    const newVal = next === NONE ? null : Number(next);
    const oldVal = prev === NONE ? null : Number(prev);
    try {
      await saveToast(() => patchProject(id, { [field]: newVal }), {
        success: `${successLabel} gespeichert.`,
      });
      recordHistory({
        label: `${successLabel} geändert (${projectName})`,
        reversible: true,
        reverse: [
          {
            id,
            label: projectName,
            apiPath: `/api/projects/${id}`,
            body: { [field]: oldVal },
          },
        ],
      });
      router.refresh();
    } catch (e) {
      setValue(prev);
      setError(e instanceof Error ? e.message : "Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  // base-ui Select braucht `items`, damit der Trigger das Label statt des Rohwerts zeigt.
  const items = [
    ...(allowNone ? [{ label: noneLabel ?? "—", value: NONE }] : []),
    ...options,
  ];
  return (
    <>
      <Select
        items={items}
        value={value}
        onValueChange={(v) => onChange(v ?? NONE)}
        disabled={saving}
      >
        <SelectTrigger className="h-11 w-full sm:h-9" aria-label={successLabel}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldError message={error} />
    </>
  );
}

// Datumsfeld (Start/Fällig). Native Date-Eingabe; speichert bei Änderung. In Autotask
// Pflichtfelder → leeres Datum wird nicht gesendet.
function DateField({
  id,
  projectName,
  field,
  current,
  successLabel,
}: {
  id: number;
  projectName: string;
  field: "endDateTime";
  current: string | null;
  successLabel: string;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(isoToDateInput(current));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Server-Wert ändert sich -> Datum angleichen (Render-Muster, kein Effect).
  const [prevCurrent, setPrevCurrent] = React.useState(current);
  if (current !== prevCurrent) {
    setPrevCurrent(current);
    setValue(isoToDateInput(current));
  }

  async function commit() {
    const nextDate = value;
    if (!nextDate || nextDate === isoToDateInput(current)) return;
    setSaving(true);
    setError(null);
    try {
      await saveToast(
        () => patchProject(id, { [field]: `${nextDate}T00:00:00` }),
        { success: `${successLabel} gespeichert.` },
      );
      // Nur reversibel, wenn es einen gültigen Alt-Wert gibt (sonst gäbe es kein
      // valides Datum zum Zurücksetzen – endDateTime ist in Autotask Pflicht).
      recordHistory({
        label: `${successLabel} geändert (${projectName})`,
        reversible: current != null,
        reverse:
          current != null
            ? [
                {
                  id,
                  label: projectName,
                  apiPath: `/api/projects/${id}`,
                  body: { [field]: current },
                },
              ]
            : undefined,
      });
      router.refresh();
    } catch (e) {
      setValue(isoToDateInput(current));
      setError(e instanceof Error ? e.message : "Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Input
        type="date"
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        className="h-11 w-full sm:h-9"
        aria-label={successLabel}
      />
      <FieldError message={error} />
    </>
  );
}
