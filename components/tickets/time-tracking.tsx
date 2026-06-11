"use client";

import * as React from "react";
import { ClockIcon, PauseIcon, PlayIcon, TimerIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TimeEntryDialog } from "@/components/tickets/time-entry-dialog";
import { NewNoteButton } from "@/components/tickets/new-note-button";

// Lokale Helfer: Zeitstempel → "HH:MM" (lokal) bzw. "YYYY-MM-DD" (lokal).
function hhmm(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}
function isoDate(ts: number): string {
  const d = new Date(ts);
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}
function fmtElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Zeiterfassung am Ticketdetail: schlanke Stoppuhr (umrahmte Anzeige + eine
// Play/Pause-Taste) plus die „Zeit erfassen"-Schaltfläche. Es gibt bewusst KEINEN
// Stopp-Knopf – „Zeit erfassen" übernimmt das: läuft die Uhr, wird der Dialog mit
// der gemessenen Dauer vorbefüllt (Von = jetzt − Dauer, Bis = jetzt). Kein eigener
// API-Pfad; nach erfolgreichem Speichern wird die Uhr zurückgesetzt.
export function TimeTracking({ ticketId }: { ticketId: number }) {
  const [running, setRunning] = React.useState(false);
  const [startedAt, setStartedAt] = React.useState<number | null>(null);
  const [accumulatedMs, setAccumulatedMs] = React.useState(0);
  const [, setTick] = React.useState(0);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [preset, setPreset] = React.useState<{
    date: string;
    from: string;
    to: string;
  } | null>(null);

  // Timer startet automatisch beim Öffnen des Tickets (Mount).
  React.useEffect(() => {
    setStartedAt(Date.now());
    setRunning(true);
  }, []);

  // Tickt sekündlich, solange die Uhr läuft (nur zur Anzeige).
  React.useEffect(() => {
    if (!running) return;
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, [running]);

  const elapsedMs =
    accumulatedMs + (running && startedAt != null ? Date.now() - startedAt : 0);

  // Play/Pause: laufen lassen ⇄ anhalten (Wert akkumulieren).
  function toggle() {
    if (running) {
      if (startedAt != null) setAccumulatedMs((a) => a + (Date.now() - startedAt));
      setStartedAt(null);
      setRunning(false);
    } else {
      setStartedAt(Date.now());
      setRunning(true);
    }
  }

  function reset() {
    setRunning(false);
    setStartedAt(null);
    setAccumulatedMs(0);
  }

  // „Zeit erfassen": Uhr anhalten und den Dialog vorbelegen. Mit gemessener Dauer
  // → Von/Bis aus der Uhr; ohne Dauer → normale Vorgabe (manuelle Erfassung).
  function openDialog() {
    const now = Date.now();
    const total =
      accumulatedMs + (running && startedAt != null ? now - startedAt : 0);
    if (running) {
      setAccumulatedMs(total);
      setStartedAt(null);
      setRunning(false);
    }
    setPreset(
      total > 0
        ? { date: isoDate(now), from: hhmm(now - total), to: hhmm(now) }
        : { date: isoDate(now), from: "09:00", to: "10:00" },
    );
    setDialogOpen(true);
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      {/* Umrahmte Zeitanzeige (mobil h-10 zu den größeren Touch-Tasten, ab sm h-8) */}
      <span className="text-muted-foreground flex h-11 items-center gap-1.5 rounded-md border px-2.5 text-sm tabular-nums sm:h-8">
        <TimerIcon className="size-4" />
        {fmtElapsed(elapsedMs)}
      </span>
      {/* Play ⇄ Pause (lucide PlayIcon/PauseIcon) */}
      <Button
        variant="outline"
        size="icon"
        className="size-11 sm:size-8"
        onClick={toggle}
        aria-label={running ? "Stoppuhr pausieren" : "Stoppuhr starten"}
      >
        {running ? <PauseIcon /> : <PlayIcon />}
      </Button>
      <Button onClick={openDialog} className="h-11 flex-1 sm:h-9 sm:flex-none">
        <ClockIcon />
        Zeit erfassen
      </Button>
      {/* „Neue Notiz" direkt neben „Zeit erfassen" (Paul). */}
      <NewNoteButton ticketId={ticketId} />

      {/* Vorbefüllter Zeit-erfassen-Dialog (kontrolliert). */}
      <TimeEntryDialog
        ticketId={ticketId}
        showTrigger={false}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialDate={preset?.date}
        initialFrom={preset?.from}
        initialTo={preset?.to}
        onSaved={reset}
      />
    </div>
  );
}
