"use client";

import * as React from "react";
import { MailIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/autotask/entities/ticket-chat";

const POLL_MS = 45_000;

function fmt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function initials(name: string): string {
  return (
    name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export function TicketChat({
  ticketId,
  me,
}: {
  ticketId: number;
  me?: { name: string; avatar: string };
}) {
  const [messages, setMessages] = React.useState<ChatMessage[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [mailNotice, setMailNotice] = React.useState<string | null>(null);
  const tempId = React.useRef(-1);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/chat`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(
          j.rateLimited
            ? "Rate-Limit erreicht (429). Aktualisierung pausiert kurz."
            : "Chat konnte nicht geladen werden.",
        );
        return;
      }
      const j = (await res.json()) as { messages: ChatMessage[] };
      setError(null);
      setMessages(j.messages);
    } catch {
      setError("Chat konnte nicht geladen werden.");
    }
  }, [ticketId]);

  React.useEffect(() => {
    load();
    // Polling nur bei sichtbarem Tab (Document Visibility); kein Dauerfeuer.
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError(null);
    setMailNotice(null);

    // Optimistisch: temporäre Outbound-Bubble sofort anzeigen.
    const optimistic: ChatMessage = {
      id: tempId.current--,
      direction: "outbound",
      noteType: 18,
      createDateTime: new Date().toISOString(),
      title: null,
      body,
      sender: "Ich",
    };
    setMessages((prev) => [...(prev ?? []), optimistic]);
    setText("");

    try {
      const res = await fetch(`/api/tickets/${ticketId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body, notify: true }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(
          j.rateLimited
            ? "Rate-Limit erreicht (429). Bitte kurz warten."
            : (j.error ?? "Senden fehlgeschlagen."),
        );
      }
      // Notiz ist gespeichert (200). Mail-Status separat melden: Notiz darf nicht
      // als Fehler erscheinen, nur weil die Mail nicht rausging (§6.3).
      const j = (await res.json().catch(() => ({}))) as {
        mail?: { attempted?: boolean; sent?: boolean; error?: string; skipped?: string };
      };
      const mail = j.mail;
      if (mail) {
        if (mail.attempted && !mail.sent) {
          setMailNotice(
            `Nachricht gespeichert, aber E-Mail nicht zugestellt: ${mail.error ?? "unbekannter Fehler"}`,
          );
        } else if (!mail.attempted && mail.skipped) {
          setMailNotice(`Nachricht gespeichert. ${mail.skipped}`);
        }
      }
      await load(); // echte Notiz holen (ersetzt die optimistische).
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Senden fehlgeschlagen.");
      setText(body); // Eingabe wiederherstellen
      await load(); // optimistische Bubble entfernen
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="h-full">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Chat</CardTitle>
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <MailIcon className="size-3.5" />
            Per E-Mail zugestellt
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex h-full flex-col gap-3">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {messages === null ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-12 w-3/4 self-end" />
            <Skeleton className="h-12 w-2/3" />
          </div>
        ) : messages.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Noch keine Kundenkommunikation</EmptyTitle>
              <EmptyDescription>
                Sobald Nachrichten ausgetauscht werden, erscheinen sie hier.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ScrollArea className="h-128 pr-3">
            <div className="flex flex-col gap-3">
              {messages.map((m) => {
                const outbound = m.direction === "outbound";
                // Eigenes Profilbild für Outbound-Bubbles (= unsere Seite). Notizen
                // werden über den API-User angelegt, daher matcht der Sender-Name
                // NICHT die angemeldete Resource – deshalb an der Richtung festmachen,
                // nicht am Namen. Inbound (Kunde) bleibt bei Initialen.
                const mine = outbound && !!me?.avatar;
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex items-end gap-2",
                      outbound && "flex-row-reverse",
                    )}
                  >
                    <Avatar className="size-7">
                      {mine && <AvatarImage src={me!.avatar} alt={m.sender} />}
                      <AvatarFallback>{initials(m.sender)}</AvatarFallback>
                    </Avatar>
                    <div
                      className={cn(
                        "flex max-w-md flex-col gap-1 rounded-lg px-3 py-2",
                        outbound
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted",
                      )}
                    >
                      <div
                        className={cn(
                          "flex items-center gap-2 text-xs",
                          outbound
                            ? "text-primary-foreground/80"
                            : "text-muted-foreground",
                        )}
                      >
                        <span className="font-medium">{m.sender}</span>
                        <span>{fmt(m.createDateTime)}</span>
                      </div>
                      <p className="text-sm break-words whitespace-pre-wrap">
                        {m.body}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {sendError && (
          <Alert variant="destructive">
            <AlertDescription>{sendError}</AlertDescription>
          </Alert>
        )}

        {mailNotice && (
          <Alert>
            <MailIcon />
            <AlertDescription>{mailNotice}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSend} className="mt-auto flex flex-col gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Nachricht an den Kunden …"
            rows={2}
            aria-label="Nachricht"
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={sending || !text.trim()}>
              Senden
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
