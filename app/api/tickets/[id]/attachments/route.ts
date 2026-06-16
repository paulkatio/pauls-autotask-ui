import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { attachments } from "@/lib/autotask/entities/attachments";
import { autotaskErrorResponse } from "@/lib/api/error-response";
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_LABEL,
} from "@/lib/autotask/attachments-shared";

export const dynamic = "force-dynamic";

// POST /api/tickets/[id]/attachments — neuen Datei-Anhang hochladen (BFF).
// Body: { fileName, dataBase64 }. Größe wird serverseitig geprüft (decodierte
// Bytes), bevor an Autotask gesendet wird. Verifiziert 2026-06-04 (s. attachments.upload).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const { id } = await params;
  const ticketId = Number(id);
  if (!Number.isFinite(ticketId)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as {
    fileName?: unknown;
    dataBase64?: unknown;
  } | null;
  const fileName =
    typeof body?.fileName === "string" ? body.fileName.trim() : "";
  const dataBase64 =
    typeof body?.dataBase64 === "string" ? body.dataBase64 : "";

  if (!fileName) {
    return NextResponse.json({ error: "Dateiname fehlt." }, { status: 400 });
  }
  if (!dataBase64) {
    return NextResponse.json({ error: "Die Datei ist leer." }, { status: 400 });
  }

  let bytes: number;
  try {
    bytes = Buffer.from(dataBase64, "base64").length;
  } catch {
    return NextResponse.json(
      { error: "Datei konnte nicht gelesen werden." },
      { status: 400 },
    );
  }
  if (bytes === 0) {
    return NextResponse.json({ error: "Die Datei ist leer." }, { status: 400 });
  }
  if (bytes > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json(
      { error: `Die Datei ist zu groß (max. ${MAX_ATTACHMENT_LABEL}).` },
      { status: 413 },
    );
  }

  try {
    const itemId = await attachments.upload(ticketId, { fileName, dataBase64 });
    return NextResponse.json({ itemId });
  } catch (e) {
    return autotaskErrorResponse(e);
  }
}
