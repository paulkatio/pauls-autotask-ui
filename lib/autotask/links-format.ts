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
