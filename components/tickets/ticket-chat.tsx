"use client";

import * as React from "react";
import { AlertCircleIcon, MailIcon, PaperclipIcon, XIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/autotask/entities/ticket-chat";

const POLL_MS = 45_000;

// Anhang-Limits (v1, nur ausgehend) – serverseitig in der Route gespiegelt.
const MAX_FILES = 5;
const MAX_FILE_MB = 10;

// Optimistische Bubble kann die gerade gesendeten Dateinamen tragen (nur Anzeige,
// bis der Reload die echte Notiz holt; die Dateien liegen dann am Ticket + in der Mail).
type LocalMessage = ChatMessage & { pendingAttachments?: string[] };

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

// Anzeigename für eigene (outbound) Bubbles: Vorname des eingeloggten Technikers.
function firstNameOf(name?: string): string | null {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first || null;
}

export function TicketChat({
  ticketId,
  me,
  contactName,
}: {
  ticketId: number;
  me?: { name: string; avatar: string };
  contactName?: string | null;
}) {
  const [messages, setMessages] = React.useState<LocalMessage[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [mailNotice, setMailNotice] = React.useState<string | null>(null);
  // Reines Kundenfenster: jede Chat-Nachricht geht per E-Mail an den Ticket-Kontakt.
  // Vor JEDEM Versand erscheint ein Bestätigungsdialog (irreversibel). Interne Notizen
  // laufen separat über „Neue Notiz" im Aktivitäts-Feed (note-form.tsx).
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  // Mail-Zustellstatus je angelegter Notiz-ID (nur Probleme). Überlebt Reloads
  // innerhalb der Session, sodass pro Nachricht sichtbar bleibt, ob die Kundenmail
  // ankam. Hinweis: Autotask speichert den Resend-Status nicht – nach einem harten
  // Seiten-Reload ist die Markierung daher weg (bekannte Grenze).
  const [delivery, setDelivery] = React.useState<
    Map<number, { kind: "failed" | "skipped"; detail: string }>
  >(new Map());
  const tempId = React.useRef(-1);
  // Anhänge, die mit der nächsten Nachricht rausgehen (Drag&Drop oder Datei-Dialog).
  const [files, setFiles] = React.useState<File[]>([]);
  const [dragOver, setDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // Scroll-Container der Nachrichtenliste – für Auto-Scroll ans Ende (neueste unten).
  const scrollRef = React.useRef<HTMLDivElement>(null);

  function addFiles(incoming: FileList | File[]) {
    const arr = Array.from(incoming);
    const tooBig = arr.find((f) => f.size > MAX_FILE_MB * 1024 * 1024);
    if (tooBig) {
      setSendError(`Datei „${tooBig.name}" ist größer als ${MAX_FILE_MB} MB.`);
      return;
    }
    setSendError(null);
    setFiles((prev) => [...prev, ...arr].slice(0, MAX_FILES));
  }

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
    // Fetch-on-Mount + Polling = legitime externe Synchronisation (kein abgeleiteter
    // State). load() ist async, setState passiert erst NACH await – also kein
    // synchrones Cascading-Render. Die Compiler-Regel ist hier ein False-Positive.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Immer zur neuesten Nachricht (unten) springen: bei Erst-Laden, Polling und Senden.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Form-Submit: Versand geht immer an den Kunden → vor jedem Senden bestätigen lassen.
  function attemptSend(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if ((!body && files.length === 0) || sending) return;
    setConfirmOpen(true);
  }

  async function doSend() {
    const body = text.trim();
    if ((!body && files.length === 0) || sending) return;
    setConfirmOpen(false);
    setSending(true);
    setSendError(null);
    setMailNotice(null);

    const sentFiles = files;
    const attachmentNames = sentFiles.map((f) => f.name);

    // Optimistisch: temporäre Outbound-Bubble sofort anzeigen (inkl. Dateinamen).
    const optimistic: LocalMessage = {
      id: tempId.current--,
      direction: "outbound",
      noteType: 18,
      createDateTime: new Date().toISOString(),
      title: null,
      body: body || attachmentNames.join(", "),
      sender: "Ich",
      pendingAttachments: attachmentNames.length ? attachmentNames : undefined,
    };
    setMessages((prev) => [...(prev ?? []), optimistic]);
    setText("");
    setFiles([]);

    try {
      let res: Response;
      if (sentFiles.length > 0) {
        // Mit Anhängen: multipart. Dateien gehen ans Ticket UND in die Kundenmail.
        const fd = new FormData();
        fd.set("text", body);
        fd.set("notify", "true");
        for (const f of sentFiles) fd.append("files", f);
        res = await fetch(`/api/tickets/${ticketId}/chat`, {
          method: "POST",
          body: fd,
        });
      } else {
        res = await fetch(`/api/tickets/${ticketId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: body, notify: true }),
        });
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(
          j.rateLimited
            ? "Rate-Limit erreicht (429). Bitte kurz warten."
            : (j.error ?? "Senden fehlgeschlagen."),
        );
      }
      // Notiz ist gespeichert (200). Mail-/Anhang-Status separat melden: Notiz darf
      // nicht als Fehler erscheinen, nur weil Mail/Anhang nicht durchging (§6.3).
      const j = (await res.json().catch(() => ({}))) as {
        itemId?: number;
        mail?: { attempted?: boolean; sent?: boolean; error?: string; skipped?: string };
        attachmentError?: string;
      };
      const mail = j.mail;
      const itemId = j.itemId;
      const notices: string[] = [];
      if (mail) {
        if (mail.attempted && !mail.sent) {
          const detail = mail.error ?? "unbekannter Fehler";
          notices.push(`E-Mail nicht zugestellt: ${detail}`);
          // Pro Notiz-ID merken → bleibt nach dem Reload an genau dieser Bubble sichtbar
          // (auch bei textgleichen Nachrichten korrekt zugeordnet).
          if (typeof itemId === "number") {
            setDelivery((p) => new Map(p).set(itemId, { kind: "failed", detail }));
          }
        } else if (!mail.attempted && mail.skipped) {
          notices.push(mail.skipped);
          if (typeof itemId === "number") {
            setDelivery((p) =>
              new Map(p).set(itemId, { kind: "skipped", detail: mail.skipped! }),
            );
          }
        }
      }
      if (j.attachmentError) {
        notices.push(`Anhang nicht am Ticket gespeichert: ${j.attachmentError}`);
      }
      setMailNotice(notices.length ? notices.join(" · ") : null);
      await load(); // echte Notiz holen (ersetzt die optimistische).
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Senden fehlgeschlagen.");
      setText(body); // Eingabe + Dateien wiederherstellen
      setFiles(sentFiles);
      await load(); // optimistische Bubble entfernen
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="flex flex-col max-h-[75dvh] xl:h-full xl:max-h-none">
      <CardHeader className="border-b">
        <div className="flex items-baseline justify-between gap-2">
          <CardTitle>Chat</CardTitle>
          {contactName && (
            <span className="text-muted-foreground truncate text-xs">
              {contactName}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent
        className={cn(
          "relative flex min-h-0 flex-1 flex-col gap-3",
          dragOver &&
            "outline-primary -outline-offset-8 outline-2 outline-dashed",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragOver) setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
      >
        {dragOver && (
          <div className="bg-background/80 text-muted-foreground pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl text-sm">
            <span className="flex items-center gap-2">
              <PaperclipIcon className="size-4" /> Dateien hier ablegen
            </span>
          </div>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div
          ref={scrollRef}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pr-1"
        >
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
            <div className="flex flex-col gap-3">
              {messages.map((m) => {
                const outbound = m.direction === "outbound";
                // Eigenes Profilbild für Outbound-Bubbles (= unsere Seite). Notizen
                // werden über den API-User angelegt, daher matcht der Sender-Name
                // NICHT die angemeldete Resource – deshalb an der Richtung festmachen,
                // nicht am Namen. Inbound (Kunde) bleibt bei Initialen.
                const mine = outbound && !!me?.avatar;
                const status = delivery.get(m.id);
                // Outbound = Vorname des eingeloggten Technikers (Notiz läuft technisch
                // über den API-User, dessen Name „AutoTask UI" hier nichts sagt).
                // Inbound = aufgelöster Name; fällt er auf "Kunde" zurück (z. B. wenn
                // Autotask den Absender nicht als Kontakt matcht), den Ticket-Kontaktnamen
                // zeigen.
                const senderLabel = outbound
                  ? (firstNameOf(me?.name) ?? m.sender)
                  : m.sender === "Kunde"
                    ? (contactName ?? m.sender)
                    : m.sender;
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex items-end gap-2",
                      outbound && "flex-row-reverse",
                    )}
                  >
                    <Avatar className="size-7 shrink-0">
                      {mine && <AvatarImage src={me!.avatar} alt={senderLabel} />}
                      <AvatarFallback>{initials(senderLabel)}</AvatarFallback>
                    </Avatar>
                    <div
                      className={cn(
                        "flex min-w-0 max-w-md flex-col gap-1",
                        outbound && "items-end",
                      )}
                    >
                      <div
                        className={cn(
                          "flex w-fit min-w-0 max-w-full flex-col gap-1 rounded-lg px-3 py-2",
                          outbound
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted",
                          status?.kind === "failed" && "ring-2 ring-destructive",
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
                          <span className="font-medium">{senderLabel}</span>
                          <span>{fmt(m.createDateTime)}</span>
                        </div>
                        <p className="text-sm break-words whitespace-pre-wrap">
                          {m.body}
                        </p>
                        {m.pendingAttachments?.length ? (
                          <div className="flex flex-col gap-0.5">
                            {m.pendingAttachments.map((name, i) => (
                              <span
                                key={i}
                                className="flex items-center gap-1 text-xs opacity-90"
                              >
                                <PaperclipIcon className="size-3 shrink-0" />
                                <span className="truncate">{name}</span>
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {status?.kind === "failed" && (
                        <span className="text-destructive flex items-center gap-1 text-xs">
                          <AlertCircleIcon className="size-3 shrink-0" />
                          E-Mail nicht zugestellt – als Notiz gespeichert
                        </span>
                      )}
                      {status?.kind === "skipped" && (
                        <span className="text-muted-foreground flex items-center gap-1 text-xs">
                          <MailIcon className="size-3 shrink-0" />
                          Nur als Notiz gespeichert (nicht gemailt)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
        )}
        </div>

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

        <form
          onSubmit={attemptSend}
          className="mt-auto flex shrink-0 flex-col gap-2 pb-[env(safe-area-inset-bottom)]"
        >
          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {files.map((f, i) => (
                <span
                  key={i}
                  className="bg-muted flex items-center gap-1 rounded-md py-1 pr-1 pl-2 text-xs"
                >
                  <PaperclipIcon className="size-3 shrink-0" />
                  <span className="max-w-40 truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                    aria-label={`${f.name} entfernen`}
                    className="text-muted-foreground hover:text-foreground rounded p-0.5"
                  >
                    <XIcon className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Nachricht an den Kunden …"
            rows={2}
            aria-label="Nachricht"
          />
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 sm:size-8"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Datei anhängen"
              disabled={sending || files.length >= MAX_FILES}
            >
              <PaperclipIcon />
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-11 sm:h-7"
              disabled={sending || (!text.trim() && files.length === 0)}
            >
              Senden &amp; mailen
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </form>
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Nachricht per E-Mail an den Kunden senden?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Die Nachricht
              {files.length > 0
                ? ` (${files.length === 1 ? "1 Anhang" : `${files.length} Anhänge`})`
                : ""}{" "}
              wird dem Ticket-Kontakt als E-Mail zugestellt und ist im
              Kundenportal sichtbar. Das lässt sich nicht zurücknehmen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => void doSend()}>
              Senden &amp; mailen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
