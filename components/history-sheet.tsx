"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HistoryIcon, Undo2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  getHistory,
  markUndone,
  clearHistory,
  subscribeHistory,
  type HistoryEntry,
} from "@/lib/history";

function fmtTime(ts: number): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

async function patchTicket(
  id: number,
  body: Record<string, number | string | null>,
): Promise<void> {
  const res = await fetch(`/api/tickets/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `Fehler (${res.status}).`);
  }
}

// Globaler Verlauf im Header. Liest den clientseitigen Verlauf (lib/history) und
// bietet „Rückgängig" für reversible Feldänderungen (re-PATCH der Alt-Werte).
export function HistorySheet() {
  const router = useRouter();
  const [entries, setEntries] = React.useState<HistoryEntry[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    const sync = () => setEntries(getHistory());
    sync();
    return subscribeHistory(sync);
  }, []);

  async function undo(entry: HistoryEntry) {
    if (!entry.reverse || entry.reverse.length === 0) return;
    setBusy(entry.id);
    let ok = 0;
    const failed: string[] = [];
    for (const op of entry.reverse) {
      try {
        await patchTicket(op.id, op.body);
        ok++;
      } catch {
        failed.push(op.ticketNumber);
      }
    }
    markUndone(entry.id);
    setBusy(null);
    if (failed.length === 0) {
      toast.success(`Rückgängig: ${ok} Ticket(s) wiederhergestellt.`);
    } else {
      toast.warning(
        `Rückgängig: ${ok} ok, ${failed.length} fehlgeschlagen (${failed.join(", ")}).`,
      );
    }
    router.refresh();
  }

  const undoableCount = entries.filter((e) => e.reversible && !e.undone).length;

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Verlauf" className="relative" />
        }
      >
        <HistoryIcon />
        {undoableCount > 0 && (
          <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-[10px] tabular-nums">
            {undoableCount > 9 ? "9+" : undoableCount}
          </span>
        )}
      </SheetTrigger>
      <SheetContent className="flex flex-col gap-0 p-0">
        <SheetHeader>
          <SheetTitle>Verlauf</SheetTitle>
          <SheetDescription>
            Letzte Aktionen auf diesem Gerät. Feldänderungen lassen sich rückgängig
            machen; andere Aktionen (Notizen, Mails, Zusammenführen) sind nur protokolliert.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1 px-4">
          {entries.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Noch keine Aktionen.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 pb-4">
              {entries.map((e) => (
                <li
                  key={e.id}
                  className="flex items-start justify-between gap-3 rounded-md border p-3"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm">{e.label}</span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {fmtTime(e.at)}
                    </span>
                  </div>
                  <div className="shrink-0">
                    {e.undone ? (
                      <Badge variant="outline">rückgängig</Badge>
                    ) : e.reversible ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy === e.id}
                        onClick={() => undo(e)}
                      >
                        <Undo2Icon />
                        Rückgängig
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        nur Protokoll
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        {entries.length > 0 && (
          <SheetFooter>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => clearHistory()}
            >
              Verlauf leeren
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
