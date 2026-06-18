"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadSimple } from "@phosphor-icons/react/ssr";

import { Button } from "@/components/ui/button";
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_LABEL,
} from "@/lib/autotask/attachments-shared";

// „Neuer Anhang" – versteckter nativer File-Input, ausgelöst über einen
// shadcn-Button. Liest die Datei clientseitig als base64 und lädt sie über die
// interne Route hoch; danach `router.refresh()` (Liste neu laden) + Toast.
export function AttachmentUpload({ ticketId }: { ticketId: number }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // erlaubt erneutes Wählen derselben Datei
    if (!file) return;

    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error(`Die Datei ist zu groß (max. ${MAX_ATTACHMENT_LABEL}).`);
      return;
    }

    setBusy(true);
    try {
      const dataBase64 = await fileToBase64(file);
      const res = await fetch(`/api/tickets/${ticketId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, dataBase64 }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        itemId?: number;
        error?: string;
      };
      if (!res.ok || !j.itemId) {
        throw new Error(j.error ?? "Anhang konnte nicht hochgeladen werden.");
      }
      toast.success("Anhang hochgeladen.");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Anhang konnte nicht hochgeladen werden.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-muted-foreground text-xs">
        Max. {MAX_ATTACHMENT_LABEL} pro Datei.
      </p>
      <input ref={inputRef} type="file" className="hidden" onChange={onPick} />
      <Button
        variant="outline"
        size="sm"
        className="h-11 sm:h-9"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <UploadSimple />
        {busy ? "Lädt hoch …" : "Neuer Anhang"}
      </Button>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () =>
      reject(new Error("Datei konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}
