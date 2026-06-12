import "server-only";

import {
  ticketUrlFrom,
  companyUrlFrom,
  projectUrlFrom,
} from "@/lib/autotask/links-format";

// Deep-Links in die echte Autotask-Weboberfläche. Aus der REST-Zone
// (`webservices{N}.autotask.net`) wird die Web-Zone (`ww{N}.autotask.net`)
// abgeleitet — bestätigt gegen `ww18`. Optionaler Override per `AUTOTASK_WEB_URL`.
//
// FAILSAFE: Alle Funktionen werfen NIE. Bei fehlender/kaputter Basis-URL geben sie
// `null` zurück; die UI blendet den Knopf dann nur aus, statt die Detailseite zu
// kippen.

export function autotaskWebBase(): string | null {
  try {
    const override = process.env.AUTOTASK_WEB_URL?.trim();
    if (override) return override.replace(/\/$/, "");

    const base = process.env.AUTOTASK_BASE_URL?.trim();
    if (!base) return null;
    const host = new URL(base).hostname; // z. B. webservices18.autotask.net
    const m = host.match(/^webservices(\d+)\.autotask\.net$/i);
    if (!m) return null;
    return `https://ww${m[1]}.autotask.net`;
  } catch {
    return null;
  }
}

export function autotaskTicketUrl(ticketId: number): string | null {
  return ticketUrlFrom(autotaskWebBase(), ticketId);
}

export function autotaskCompanyUrl(companyId: number): string | null {
  return companyUrlFrom(autotaskWebBase(), companyId);
}

export function autotaskProjectUrl(projectId: number): string | null {
  return projectUrlFrom(autotaskWebBase(), projectId);
}
