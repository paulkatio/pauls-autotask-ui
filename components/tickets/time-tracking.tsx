"use client";

import * as React from "react";
import { Clock, Pause, Play, Timer } from "@phosphor-icons/react/ssr";

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
  const [running, setRunning] = React.useState(true); // läuft ab Mount
  const [accumulatedMs, setAccumulatedMs] = React.useState(0);
  const [elapsedMs, setElapsedMs] = React.useState(0); // angezeigte Dauer
  // Startzeitpunkt der aktuellen Laufphase als Ref: hält Date.now() aus dem Render
  // heraus (Purity-Regel) – gelesen/gesetzt nur in Event-Handlern + Interval.
  const startRef = React.useRef<number | null>(null);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [preset, setPreset] = React.useState<{
    date: string;
    from: string;
    to: string;
  } | null>(null);

  // Läuft die Uhr: Startzeit merken und sekündlich die angezeigte Dauer
  // fortschreiben. setState ausschließlich im Interval-Callback (kein setState im
  // Effect-Body), Date.now() ebenfalls nur im Callback (kein Date.now im Render).
  React.useEffect(() => {
    if (!running) return;
    if (startRef.current == null) startRef.current = Date.now();
    const i = setInterval(() => {
      const start = startRef.current ?? Date.now();
      setElapsedMs(accumulatedMs + (Date.now() - start));
    }, 1000);
    return () => clearInterval(i);
  }, [running, accumulatedMs]);

  // Play/Pause: laufen lassen ⇄ anhalten (Wert akkumulieren).
  function toggle() {
    if (running) {
      const add = startRef.current != null ? Date.now() - startRef.current : 0;
      const total = accumulatedMs + add;
      setAccumulatedMs(total);
      setElapsedMs(total);
      startRef.current = null;
      setRunning(false);
    } else {
      startRef.current = Date.now();
      setRunning(true);
    }
  }

  function reset() {
    setRunning(false);
    startRef.current = null;
    setAccumulatedMs(0);
    setElapsedMs(0);
  }

  // „Zeit erfassen": Uhr anhalten und den Dialog vorbelegen. Mit gemessener Dauer
  // → Von/Bis aus der Uhr; ohne Dauer → normale Vorgabe (manuelle Erfassung).
  function openDialog() {
    const now = Date.now();
    const total =
      accumulatedMs +
      (running && startRef.current != null ? now - startRef.current : 0);
    if (running) {
      setAccumulatedMs(total);
      setElapsedMs(total);
      startRef.current = null;
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
      <span className="text-muted-foreground flex h-11 items-center gap-1.5 rounded-md border px-2.5 text-sm tabular-nums sm:h-9">
        <Timer className="size-4" />
        {fmtElapsed(elapsedMs)}
      </span>
      {/* Play ⇄ Pause */}
      <Button
        variant="outline"
        size="icon"
        className="size-11 sm:size-8"
        onClick={toggle}
        aria-label={running ? "Stoppuhr pausieren" : "Stoppuhr starten"}
      >
        {running ? <Pause /> : <Play />}
      </Button>
      <Button onClick={openDialog} className="h-11 flex-1 sm:h-9 sm:flex-none">
        <Clock />
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
