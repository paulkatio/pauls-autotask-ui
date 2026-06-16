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
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { StatusDot } from "@/components/status-indicator";

interface WorkType {
  id: number;
  name: string;
}

// "Abgeschlossen" = Autotask-System-Status „Complete". Wechsel hierauf verlangt
// eine Zusammenfassung (wie beim Statusfeld im Detail).
const CLOSED_STATUS_ID = 5;

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

  // Optionaler Status-Wechsel + Abschlussbenachrichtigung an den Kunden.
  const [statuses, setStatuses] = React.useState<
    { value: number; label: string }[]
  >([]);
  const [currentStatus, setCurrentStatus] = React.useState<number | null>(null);
  const [statusVal, setStatusVal] = React.useState<string>("");
  const [notifyCustomer, setNotifyCustomer] = React.useState(false);
  const [customerText, setCustomerText] = React.useState("");

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
          statuses?: { value: number; label: string }[];
          currentStatus?: number | null;
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
        setStatuses(j.statuses ?? []);
        setCurrentStatus(j.currentStatus ?? null);
        // Status-Select mit dem aktuellen Status vorbelegen (kein Wechsel = kein PATCH).
        setStatusVal(j.currentStatus == null ? "" : String(j.currentStatus));
      } catch {
        if (active) setLoadError("Tätigkeitsarten konnten nicht geladen werden.");
      }
    })();
    return () => {
      active = false;
    };
  }, [open, workTypes, ticketId]);

  // Vorbelegung (z. B. aus der Stoppuhr): beim Öffnen Datum/Von/Bis übernehmen.
  // Während des Renders statt im Effect (React-Muster, kein setState-im-Effect).
  const presetKey = `${open}|${initialDate ?? ""}|${initialFrom ?? ""}|${initialTo ?? ""}`;
  const [prevPresetKey, setPrevPresetKey] = React.useState(presetKey);
  if (presetKey !== prevPresetKey) {
    setPrevPresetKey(presetKey);
    if (open) {
      if (initialDate) setDate(initialDate);
      if (initialFrom) setFrom(initialFrom);
      if (initialTo) setTo(initialTo);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || hours == null || !billingCodeId) return;

    const statusChanged = statusVal !== "" && Number(statusVal) !== currentStatus;
    const closing = statusChanged && Number(statusVal) === CLOSED_STATUS_ID;
    if (closing && !notes.trim()) {
      setError("Beim Abschließen ist eine Zusammenfassung erforderlich.");
      return;
    }
    if (notifyCustomer && !customerText.trim()) {
      setError("Bitte den Text der Abschlussbenachrichtigung eingeben.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // 1) Zeiteintrag = Primäraktion. Schlägt sie fehl, brechen wir ab.
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

      // Folgeaktionen sind best effort: ein Fehler hier kippt den Zeiteintrag nicht,
      // wird aber als Warnung gemeldet.
      const warnings: string[] = [];

      // 2) Optionaler Status-Wechsel.
      if (statusChanged) {
        try {
          const r = await fetch(`/api/tickets/${ticketId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: Number(statusVal) }),
          });
          if (!r.ok) {
            const jj = (await r.json().catch(() => ({}))) as { error?: string };
            warnings.push(`Status nicht geändert: ${jj.error ?? "Fehler"}`);
          }
        } catch {
          warnings.push("Status nicht geändert.");
        }
      }

      // 3) Optionale Abschlussbenachrichtigung an den Kunden (separater Text, Chat-Pfad
      //    = Notiz noteType 18 + Resend-Mail).
      if (notifyCustomer && customerText.trim()) {
        try {
          const r = await fetch(`/api/tickets/${ticketId}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: customerText.trim(), notify: true }),
          });
          if (!r.ok) {
            const jj = (await r.json().catch(() => ({}))) as { error?: string };
            warnings.push(`Kundenmail nicht gesendet: ${jj.error ?? "Fehler"}`);
          }
        } catch {
          warnings.push("Kundenmail nicht gesendet.");
        }
      }

      if (warnings.length) {
        toast.warning(`Zeiteintrag erfasst. ${warnings.join(" · ")}`);
      } else {
        toast.success(`Zeiteintrag erfasst (${formatHours(hours)}).`);
      }
      setOpen(false);
      setNotes("");
      setAppendToResolution(false);
      setNotifyCustomer(false);
      setCustomerText("");
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
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <ResponsiveDialogTrigger render={<Button />}>
          <ClockIcon />
          Zeit erfassen
        </ResponsiveDialogTrigger>
      )}
      <ResponsiveDialogContent className="sm:max-w-xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Zeit erfassen</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Zeiteintrag für dieses Ticket anlegen.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <ResponsiveDialogBody className="flex flex-col gap-4">
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

          {/* Optionaler Status-Wechsel beim Erfassen (Default = aktueller Status). */}
          {statuses.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="te-status">Status</Label>
              <Select
                items={statuses.map((s) => ({
                  label: s.label,
                  value: String(s.value),
                }))}
                value={statusVal}
                onValueChange={(v) => setStatusVal(String(v))}
              >
                <SelectTrigger id="te-status" className="w-full">
                  <span className="flex min-w-0 items-center gap-2">
                    {statusVal && <StatusDot status={Number(statusVal)} />}
                    <SelectValue placeholder="Status wählen" />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {statuses.map((s) => (
                      <SelectItem key={s.value} value={String(s.value)}>
                        <span className="flex items-center gap-2">
                          <StatusDot status={s.value} />
                          {s.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Abschlussbenachrichtigung an den Kunden (separater Text, getrennt von der
              internen Zusammenfassung). */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Switch
                id="te-notify"
                checked={notifyCustomer}
                onCheckedChange={(v) => setNotifyCustomer(Boolean(v))}
              />
              <Label htmlFor="te-notify">
                Abschlussbenachrichtigung per E-Mail an den Kunden
              </Label>
            </div>
            {notifyCustomer && (
              <>
                <Textarea
                  id="te-customer"
                  value={customerText}
                  onChange={(e) => setCustomerText(e.target.value)}
                  placeholder="Nachricht an den Kunden …"
                  rows={3}
                  aria-label="Nachricht an den Kunden"
                />
                <p className="text-muted-foreground text-xs">
                  Separater Text – geht per E-Mail an den Ticket-Kontakt und steht
                  im Ticket. Lässt sich nicht zurücknehmen.
                </p>
              </>
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
          </ResponsiveDialogBody>

          <ResponsiveDialogFooter>
            <ResponsiveDialogClose render={<Button type="button" variant="outline" className="h-11 sm:h-9" />}>
              Abbrechen
            </ResponsiveDialogClose>
            <Button type="submit" className="h-11 sm:h-9" disabled={saving || hours == null || !billingCodeId}>
              {saving ? "Speichern …" : "Speichern"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
