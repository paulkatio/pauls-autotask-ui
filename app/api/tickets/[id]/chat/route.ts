import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import {
  getTicketChat,
  sendTicketChatNote,
} from "@/lib/autotask/entities/ticket-chat";
import { AutotaskError } from "@/lib/autotask/client";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const { id } = await params;
  const num = Number(id);
  if (!Number.isFinite(num)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }
  try {
    const messages = await getTicketChat(num);
    return NextResponse.json({ messages });
  } catch (e) {
    if (e instanceof AutotaskError) {
      const rateLimited = e.status === 429;
      return NextResponse.json(
        { error: `Autotask-Fehler (${e.status})`, rateLimited },
        { status: rateLimited ? 429 : 502 },
      );
    }
    return NextResponse.json({ error: "Unerwarteter Fehler" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const { id } = await params;
  const num = Number(id);
  if (!Number.isFinite(num)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as {
    text?: unknown;
    notify?: unknown;
  } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const notify = body?.notify !== false; // Default: an
  if (!text) {
    return NextResponse.json(
      { error: "Nachricht darf nicht leer sein." },
      { status: 400 },
    );
  }

  try {
    const itemId = await sendTicketChatNote(num, text, notify);
    return NextResponse.json({ itemId });
  } catch (e) {
    if (e instanceof AutotaskError) {
      const rateLimited = e.status === 429;
      return NextResponse.json(
        { error: `Autotask-Fehler (${e.status})`, rateLimited },
        { status: rateLimited ? 429 : 502 },
      );
    }
    return NextResponse.json({ error: "Unerwarteter Fehler" }, { status: 500 });
  }
}
