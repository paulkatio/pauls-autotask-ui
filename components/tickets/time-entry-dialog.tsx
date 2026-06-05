"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClockIcon } from "lucide-react";
import { toast } from "sonner";

import { formatHours } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface WorkType {
  id: number;
  name: string;
}

function todayIso(): string {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

function computeHours(from: string, to: string): number | null {
  if (!from || !to) return null;
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  if ([fh, fm, th, tm].some((n) => !Number.isFinite(n))) return null;
  const mins = th * 60 + tm - (fh * 60 + fm);
  if (mins <= 0) return null;
  return Math.round((mins / 60) * 100) / 100;
}

export function TimeEntryDialog({
  ticketId,
  open: openProp,
  onOpenChange,
  initialDate,
  initialFrom,
  initialTo,
  showTrigger = true,
  onSaved,
}: {
  ticketId: number;
  // Optional kontrollierter Modus (z. B. von der Stoppuhr geöffnet + vorbelegt).
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  initialDate?: string;
  initialFrom?: string;
  initialTo?: string;
  showTrigger?: boolean;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = React.useCallback(
    (o: boolean) => {
      onOpenChange?.(o);
      if (openProp === undefined) setInternalOpen(o);
    },
    [onOpenChange, openProp],
  );

  const [workTypes, setWorkTypes] = React.useState<WorkType[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [date, setDate] = React.useState(todayIso());
  const [from, setFrom] = React.useState("09:00");
  const [to, setTo] = React.useState("10:00");
  const [billingCodeId, setBillingCodeId] = React.useState<string>("");
  const [notes, setNotes] = React.useState("");
  const [appendToResolution, setAppendToResolution] = React.useState(false);

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const hours = computeHours(from, to);

  // Tätigkeitsarten laden, sobald der Dialog geöffnet wird (einmalig).
  React.useEffect(() => {
    if (!open || workTypes !== null) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/tickets/${ticketId}/time`, {
          cache: "no-store",
        });
        const j = (await res.json().catch(() => ({}))) as {
          workTypes?: WorkType[];
          error?: string;
        };
        if (!active) return;
        if (!res.ok) {
          setLoadError(j.error ?? "Tätigkeitsarten konnten nicht geladen werden.");
          return;
        }
        const list = j.workTypes ?? [];
        setWorkTypes(list);
        // Remote-Support vorauswählen, falls vorhanden (sonst leer lassen).
        const preset = list.find((w) => w.name === "Remote-Support");
        if (preset) setBillingCodeId(String(preset.id));
      } catch {
        if (active) setLoadError("Tätigkeitsarten konnten nicht geladen werden.");
      }
    })();
    return () => {
      active = false;
    };
  }, [open, workTypes, ticketId]);

  // Vorbelegung (z. B. aus der Stoppuhr): beim Öffnen Datum/Von/Bis übernehmen.
  React.useEffect(() => {
    if (!open) return;
    if (initialDate) setDate(initialDate);
    if (initialFrom) setFrom(initialFrom);
    if (initialTo) setTo(initialTo);
  }, [open, initialDate, initialFrom, initialTo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || hours == null || !billingCodeId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          from,
          to,
          billingCodeId,
          summaryNotes: notes,
          appendToResolution,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        itemId?: number;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(j.error ?? "Zeiteintrag konnte nicht erstellt werden.");
      }
      toast.success(`Zeiteintrag erfasst (${formatHours(hours)}).`);
      setOpen(false);
      setNotes("");
      setAppendToResolution(false);
      onSaved?.();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Zeiteintrag konnte nicht erstellt werden.",
      );
    } finally {
      setSaving(false);
    }
  }

  const workTypeItems = (workTypes ?? []).map((w) => ({
    label: w.name,
    value: String(w.id),
  }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <DialogTrigger render={<Button />}>
          <ClockIcon />
          Zeit erfassen
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Zeit erfassen</DialogTitle>
          <DialogDescription>
            Zeiteintrag für dieses Ticket anlegen.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Wichtigstes Feld – ganz oben und größer. */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="te-notes" className="text-base">
              Zusammenfassung der ausgeführten Arbeit
            </Label>
            <Textarea
              id="te-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Was wurde gemacht?"
              rows={5}
              autoFocus
            />
            <div className="flex items-center gap-2">
              <Switch
                id="te-append"
                checked={appendToResolution}
                onCheckedChange={(v) => setAppendToResolution(Boolean(v))}
              />
              <Label htmlFor="te-append">
                Zusammenfassung an die Lösung anhängen
              </Label>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="te-date">Datum</Label>
            <Input
              id="te-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="te-from">Von</Label>
              <Input
                id="te-from"
                type="time"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="te-to">Bis</Label>
              <Input
                id="te-to"
                type="time"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                required
              />
            </div>
          </div>

          <p className="text-muted-foreground text-sm">
            Dauer:{" "}
            <span className="text-foreground font-medium tabular-nums">
              {formatHours(hours)}
            </span>
          </p>

          <div className="flex flex-col gap-2">
            <Label htmlFor="te-worktype">Tätigkeitsart</Label>
            {workTypes === null && !loadError ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <Select
                items={workTypeItems}
                value={billingCodeId}
                onValueChange={(v) => setBillingCodeId(String(v))}
              >
                <SelectTrigger id="te-worktype" className="w-full">
                  <SelectValue placeholder="Tätigkeitsart wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {workTypeItems.map((i) => (
                      <SelectItem key={i.value} value={i.value}>
                        {i.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          </div>

          {loadError && (
            <Alert variant="destructive">
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
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
            <Button type="submit" disabled={saving || hours == null || !billingCodeId}>
              {saving ? "Speichern …" : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
