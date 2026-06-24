import { NextResponse } from "next/server";

import { guardApi } from "@/lib/security/api-guard";
import { RL, enforceRateLimit } from "@/lib/security/rate-limit";
import {
  getTicketChat,
  sendTicketChatNote,
} from "@/lib/autotask/entities/ticket-chat";
import { autotaskErrorResponse } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";

// Anhang-Limits (v1, nur ausgehend). Konservativ unter Resends ~40 MB/Mail.
const MAX_FILES = 5;
const MAX_FILE_MB = 10;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guardApi(req, { rateLimit: RL.read });
  if (!g.ok) return g.res;
  const { id } = await params;
  const num = Number(id);
  if (!Number.isFinite(num)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }
  try {
    const messages = await getTicketChat(num);
    return NextResponse.json({ messages });
  } catch (e) {
    return autotaskErrorResponse(e);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guardApi(req, { rateLimit: RL.write });
  if (!g.ok) return g.res;
  const session = g.session;
  const { id } = await params;
  const num = Number(id);
  if (!Number.isFinite(num)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  // FAIL-SAFE: Mail nur bei EXPLIZITEM notify === true. Fehlt das Feld, wird die
  // Notiz angelegt, aber KEINE Kunden-Mail versendet (Sicherheits-Audit: früher
  // war der Default „an" → jeder Klick mailte ungewollt an echte Kunden).
  let text = "";
  let html = "";
  let notify = false;
  const files: { fileName: string; dataBase64: string }[] = [];

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    // Mit Anhängen: multipart. Dateien -> base64 (für Autotask-Upload + Resend).
    const form = await req.formData();
    const rawText = form.get("text");
    text = typeof rawText === "string" ? rawText.trim() : "";
    const rawHtml = form.get("html");
    html = typeof rawHtml === "string" ? rawHtml : "";
    notify = form.get("notify") === "true";

    const uploaded = form.getAll("files").filter((f): f is File => f instanceof File);
    if (uploaded.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Maximal ${MAX_FILES} Dateien pro Nachricht.` },
        { status: 400 },
      );
    }
    let total = 0;
    for (const file of uploaded) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: `Datei „${file.name}" ist größer als ${MAX_FILE_MB} MB.` },
          { status: 400 },
        );
      }
      total += file.size;
      if (total > MAX_TOTAL_BYTES) {
        return NextResponse.json(
          { error: "Anhänge insgesamt zu groß (max. 25 MB)." },
          { status: 400 },
        );
      }
      const buf = Buffer.from(await file.arrayBuffer());
      files.push({ fileName: file.name, dataBase64: buf.toString("base64") });
    }
    // Anhang ohne Text: Dateinamen als Nachrichtentext (Notiz/Betreff brauchen Inhalt).
    if (!text && files.length > 0) {
      text = files.map((f) => f.fileName).join(", ");
    }
  } else {
    const body = (await req.json().catch(() => null)) as {
      text?: unknown;
      html?: unknown;
      notify?: unknown;
    } | null;
    text = typeof body?.text === "string" ? body.text.trim() : "";
    html = typeof body?.html === "string" ? body.html : "";
    notify = body?.notify === true;
  }

  if (!text && files.length === 0) {
    return NextResponse.json(
      { error: "Nachricht darf nicht leer sein." },
      { status: 400 },
    );
  }

  // Kunden-Mail (notify) zusätzlich eng drosseln – getrennt vom Notiz-Budget, damit
  // interne Notizen (notify=false) nicht limitiert werden, Mail-Spam aber gekappt ist.
  if (notify) {
    const limited = await enforceRateLimit(session.id, RL.email);
    if (limited) return limited;
  }

  try {
    const result = await sendTicketChatNote(
      num,
      text,
      notify,
      session.displayName,
      files,
      html,
    );
    return NextResponse.json(result);
  } catch (e) {
    return autotaskErrorResponse(e);
  }
}
