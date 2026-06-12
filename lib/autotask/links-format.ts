// Reine URL-Formatierer für Autotask-Web-Deeplinks – KEIN server-only (auch im
// Client nutzbar, z. B. im Header-Link). Die Web-Basis (ww{N}.autotask.net) wird
// serverseitig ermittelt (lib/autotask/links.ts) und hier nur eingesetzt.

export function ticketUrlFrom(base: string | null, id: number): string | null {
  if (!base || !Number.isFinite(id)) return null;
  return `${base}/Mvc/ServiceDesk/TicketDetail.mvc?ticketId=${id}`;
}

export function companyUrlFrom(base: string | null, id: number): string | null {
  if (!base || !Number.isFinite(id)) return null;
  return `${base}/Mvc/CRM/AccountDetail.mvc?accountId=${id}`;
}

// Projekt-Deeplink in die Autotask-Weboberfläche. Pfad von Paul aus einer echten
// Projekt-URL bestätigt (2026-06-12) und gegen ww18 geprüft (→ Login-Redirect = gültig):
// die Action sitzt als Segment HINTER `.mvc` (`ProjectDetail.mvc/ProjectDetail`), nicht
// als reiner Query – darum schlugen die früheren `*.mvc?projectId=`-Versuche fehl.
export function projectUrlFrom(base: string | null, id: number): string | null {
  if (!base || !Number.isFinite(id)) return null;
  return `${base}/Mvc/Projects/ProjectDetail.mvc/ProjectDetail?gridConfiguration=0&initialContentPage=0&projectId=${id}`;
}
