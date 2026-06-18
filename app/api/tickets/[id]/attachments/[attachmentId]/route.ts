import { NextResponse } from "next/server";

import { guardApi } from "@/lib/security/api-guard";
import { RL } from "@/lib/security/rate-limit";
import { attachments } from "@/lib/autotask/entities/attachments";
import { autotaskErrorResponse } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";

// Datei-Download eines Ticket-Anhangs (lesend). Holt die base64-Bytes serverseitig
// über /TicketAttachments/{id} und streamt sie an den Browser. Zugriffsschutz:
// der Anhang muss zum Ticket gehören (getForDownload prüft das).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const g = await guardApi(req, { rateLimit: RL.read });
  if (!g.ok) return g.res;
  const { id, attachmentId } = await params;
  const ticketId = Number(id);
  const aid = Number(attachmentId);
  if (!Number.isFinite(ticketId) || !Number.isFinite(aid)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  try {
    const att = await attachments.getForDownload(ticketId, aid);
    if (!att || !att.data) {
      return NextResponse.json({ error: "Anhang nicht gefunden" }, { status: 404 });
    }
    const bytes = Buffer.from(att.data, "base64");
    const filename = att.fullPath || att.title || `anhang-${aid}`;
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": att.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, no-store",
        // Defense-in-depth: kein MIME-Sniffing auf diese (von Autotask gelieferte,
        // letztlich Uploader-beeinflusste) Content-Type-Angabe; zusätzlich die
        // Antwort hart sandboxen, falls sie je doch im Browser landet.
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (e) {
    return autotaskErrorResponse(e);
  }
}
