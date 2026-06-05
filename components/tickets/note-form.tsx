"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LockIcon, MessageSquarePlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Inline-Formular für eine interne Notiz im Aktivität-Feed. Schreibt über die
// interne Route POST /api/tickets/[id]/note (immer intern, nie kundensichtbar).
export function NoteForm({ ticketId }: { ticketId: number }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [text, setText] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function reset() {
    setTitle("");
    setText("");
    setError(null);
  }

  async function submit() {
    if (!text.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, text }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        itemId?: number;
        error?: string;
      };
      if (!res.ok || !j.itemId) {
        throw new Error(j.error ?? "Notiz konnte nicht gespeichert werden.");
      }
      toast.success("Notiz hinzugefügt.");
      reset();
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Notiz konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <MessageSquarePlusIcon />
        Neue Notiz
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="note-title">Titel (optional)</Label>
        <Input
          id="note-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Kurzer Betreff"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="note-text">Notiz</Label>
        <Textarea
          id="note-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Interne Notiz zu diesem Ticket …"
          rows={4}
          autoFocus
        />
      </div>
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <LockIcon className="size-3.5 shrink-0" />
        Interne Notiz – für den Kunden nicht sichtbar.
      </p>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={saving || !text.trim()}>
          {saving ? "Speichern …" : "Speichern"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          disabled={saving}
        >
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
