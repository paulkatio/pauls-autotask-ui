import "server-only";

import { tickets } from "@/lib/autotask/entities/tickets";
import { companies } from "@/lib/autotask/entities/companies";
import { contacts } from "@/lib/autotask/entities/contacts";
import { resources } from "@/lib/autotask/entities/resources";
import { configurationItems } from "@/lib/autotask/entities/config-items";
import { contracts } from "@/lib/autotask/entities/contracts";
import { ticketNotes } from "@/lib/autotask/entities/ticket-notes";
import { timeEntries } from "@/lib/autotask/entities/time-entries";
import { attachments } from "@/lib/autotask/entities/attachments";
import { ticketChecklist } from "@/lib/autotask/entities/ticket-checklist";
import {
  ticketSecondaryResources,
  type SecondaryResourceRow,
} from "@/lib/autotask/entities/ticket-secondary-resources";
import type {
  Ticket,
  TicketNote,
  TimeEntry,
  TicketAttachment,
  TicketChecklistItem,
} from "@/lib/autotask/types";
import type { RefOption } from "@/lib/autotask/entities/contacts";

export interface TicketRefOptions {
  contacts: RefOption[];
  devices: RefOption[];
  contracts: RefOption[];
}

export interface TicketCompany {
  name: string | null;
  address1: string | null;
  address2: string | null;
  postalCode: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
}

export interface TicketContact {
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobilePhone: string | null;
  receivesEmailNotifications: boolean | null;
}

export interface TicketDevice {
  title: string | null;
  number: string | null;
  serialNumber: string | null;
  location: string | null;
  installDate: string | null;
  warrantyExpirationDate: string | null;
}

export interface EnrichedTimeEntry extends TimeEntry {
  resourceName: string | null;
  workTypeName: string | null;
}

export interface TicketTimeTotals {
  worked: number;
  estimated: number | null;
  billable: number;
  nonBillable: number;
}

export interface TicketDetail {
  ticket: Ticket;
  resolution: string | null;
  company: TicketCompany | null;
  companyName: string | null;
  contact: TicketContact | null;
  device: TicketDevice | null;
  contractName: string | null;
  assignedResourceName: string | null;
  secondaryResources: SecondaryResourceRow[];
  notes: TicketNote[];
  timeEntries: EnrichedTimeEntry[];
  timeTotals: TicketTimeTotals;
  attachments: TicketAttachment[];
  checklist: TicketChecklistItem[];
  // Firmengefilterte Auswahllisten für die Referenz-Picker (B15c).
  refOptions: TicketRefOptions;
}

function fullName(first?: string, last?: string): string {
  return `${first ?? ""} ${last ?? ""}`.trim();
}

function blank(s?: string | null): string | null {
  const t = (s ?? "").trim();
  return t === "" ? null : t;
}

// Lädt das Ticket und löst alle Referenzen PARALLEL auf (verschiedene Entitäten →
// der per-Entität-Limiter erlaubt das, kein N+1). Gibt null bei 404 (Ticket fehlt).
export async function getTicketDetail(id: number): Promise<TicketDetail | null> {
  const ticket = await tickets.get(id);
  if (!ticket) return null;

  const companyId = ticket.companyID ?? null;
  const [
    company,
    contact,
    device,
    resource,
    contractName,
    notes,
    times,
    contactOptions,
    deviceOptions,
    contractOptions,
    atts,
    workTypeList,
    checklist,
    secondaryResources,
  ] = await Promise.all([
    companyId != null
      ? companies.get(companyId).catch(() => null)
      : Promise.resolve(null),
    ticket.contactID != null
      ? contacts.get(ticket.contactID)
      : Promise.resolve(null),
    ticket.configurationItemID != null
      ? configurationItems.get(ticket.configurationItemID)
      : Promise.resolve(null),
    ticket.assignedResourceID != null
      ? resources.get(ticket.assignedResourceID)
      : Promise.resolve(null),
    ticket.contractID != null
      ? contracts.nameById(ticket.contractID)
      : Promise.resolve(null),
    ticketNotes.byTicket(id),
    timeEntries.byTicket(id),
    companyId != null ? contacts.byCompany(companyId) : Promise.resolve([]),
    companyId != null
      ? configurationItems.byCompany(companyId)
      : Promise.resolve([]),
    companyId != null ? contracts.byCompany(companyId) : Promise.resolve([]),
    // Anhänge/Tätigkeitsarten sind Beiwerk -> dürfen das Ticket nie kippen.
    // Hinweis: Der App-API-User sieht aktuell KEINE Anhänge (Sandbox-Security-Level;
    // verifiziert 2026-06-03) -> Liste bleibt leer (sauberer Empty-State).
    attachments.byTicket(id).catch(() => []),
    timeEntries.workTypes().catch(() => []),
    // Checkliste = Beiwerk: ein Fehler darf das Ticket nie kippen. Lese-Pfad
    // (Top-Level + ticketID) ist verifiziert (2026-06-11), darum Catch ok.
    ticketChecklist.byTicket(id).catch(() => []),
    // Zusätzliche Mitarbeiter = Beiwerk -> Fehler darf das Ticket nie kippen.
    ticketSecondaryResources.byTicket(id).catch(() => []),
  ]);

  // Mitarbeiternamen der Zeiteinträge in EINEM Request nachladen (kein N+1).
  const resourceIds = times
    .map((t) => t.resourceID)
    .filter((n): n is number => typeof n === "number");
  const resourceNames = await resources
    .namesByIds(resourceIds)
    .catch(() => new Map<number, string>());
  const workTypeNames = new Map(workTypeList.map((w) => [w.id, w.name]));

  const enrichedTimes: EnrichedTimeEntry[] = times.map((t) => ({
    ...t,
    resourceName:
      t.resourceID != null ? (resourceNames.get(t.resourceID) ?? null) : null,
    workTypeName:
      t.billingCodeID != null
        ? (workTypeNames.get(t.billingCodeID) ?? null)
        : null,
  }));

  const worked = times.reduce((s, t) => s + (t.hoursWorked ?? 0), 0);
  const billable = times.reduce((s, t) => s + (t.hoursToBill ?? 0), 0);
  const timeTotals: TicketTimeTotals = {
    worked,
    estimated: ticket.estimatedHours ?? null,
    billable,
    nonBillable: Math.max(0, worked - billable),
  };

  return {
    ticket,
    resolution: blank(ticket.resolution),
    company: company
      ? {
          name: blank(company.companyName),
          address1: blank(company.address1),
          address2: blank(company.address2),
          postalCode: blank(company.postalCode),
          city: blank(company.city),
          state: blank(company.state),
          phone: blank(company.phone),
        }
      : null,
    companyName: blank(company?.companyName),
    contact: contact
      ? {
          name: fullName(contact.firstName, contact.lastName),
          title: blank(contact.title),
          email: blank(contact.emailAddress),
          phone: blank(contact.phone),
          mobilePhone: blank(contact.mobilePhone),
          receivesEmailNotifications: contact.receivesEmailNotifications ?? null,
        }
      : null,
    device: device
      ? {
          title: blank(device.referenceTitle),
          number: blank(device.referenceNumber),
          serialNumber: blank(device.serialNumber),
          location: blank(device.location),
          installDate: blank(device.installDate),
          warrantyExpirationDate: blank(device.warrantyExpirationDate),
        }
      : null,
    contractName,
    assignedResourceName: resource
      ? fullName(resource.firstName, resource.lastName) || null
      : null,
    secondaryResources,
    notes,
    timeEntries: enrichedTimes,
    timeTotals,
    attachments: atts,
    checklist,
    refOptions: {
      contacts: contactOptions,
      devices: deviceOptions,
      contracts: contractOptions,
    },
  };
}
