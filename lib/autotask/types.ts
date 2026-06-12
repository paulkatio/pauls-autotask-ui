// Getypte Modelle gemäß in Phase 0 (V5) verifizierten Feldnamen.
// `id` ist immer vorhanden; übrige Felder optional, da Queries via IncludeFields
// nur eine Teilmenge zurückgeben. Nur real bestätigte Feldnamen aufnehmen.

export interface Ticket {
  id: number;
  ticketNumber?: string;
  title?: string;
  description?: string;
  status?: number;
  priority?: number;
  queueID?: number | null;
  assignedResourceID?: number | null;
  companyID?: number;
  contactID?: number | null;
  configurationItemID?: number | null;
  contractID?: number | null;
  source?: number | null;
  ticketType?: number | null;
  issueType?: number | null;
  subIssueType?: number | null;
  assignedResourceRoleID?: number | null;
  createDate?: string;
  dueDateTime?: string | null;
  completedDate?: string | null;
  lastActivityDate?: string;
  // Wer war für die letzte Aktivität verantwortlich? 1 = Resource (Mitarbeiter),
  // 2 = Contact (Kunde). isQueryable:false -> nur clientseitig nutzbar (B15 K4).
  lastActivityPersonType?: number;
  serviceLevelAgreementID?: number | null;
  serviceLevelAgreementHasBeenMet?: boolean | null;
  firstResponseDueDateTime?: string | null;
  resolutionPlanDueDateTime?: string | null;
  resolvedDueDateTime?: string | null;
  // Lösungstext (string, 32000; verifiziert 2026-06-03). Geschätzte Stunden.
  resolution?: string | null;
  estimatedHours?: number | null;
}

export interface TicketNote {
  id: number;
  ticketID?: number;
  title?: string;
  description?: string;
  noteType?: number;
  publish?: number;
  createDateTime?: string;
  creatorResourceID?: number | null;
  createdByContactID?: number | null;
  lastActivityDate?: string;
}

// Ticket-Checkliste (in Autotask eingebaute „To-Dos"). Eigener Objekt-Endpoint
// TicketChecklistItems; Felder verifiziert via entityInformation/fields (2026-06-11).
export interface TicketChecklistItem {
  id: number;
  ticketID?: number;
  itemName?: string;
  isCompleted?: boolean;
  isImportant?: boolean;
  position?: number;
  completedDateTime?: string | null;
  completedByResourceID?: number | null;
}

// Autotask-Projekt (Felder via entityInformation/fields verifiziert 2026-06-11,
// Detailfelder 2026-06-12). `status` ist eine eigene Picklist (0 Inaktiv …
// 5 Abgeschlossen). „Offen" = status != 5, analog zu Tickets.
// projectLeadResourceID = Projektleiter.
export interface Project {
  id: number;
  projectName?: string;
  projectNumber?: string;
  status?: number;
  projectType?: number;
  companyID?: number;
  projectLeadResourceID?: number | null;
  completedPercentage?: number | null;
  startDateTime?: string | null;
  endDateTime?: string | null;
  lastActivityDateTime?: string | null;
  description?: string | null;
}

// Projektaufgabe (REST-Entität `Tasks`, Filter `projectID`; verifiziert 2026-06-12).
// `status` ist eine EIGENE Picklist (nicht Projects.status).
export interface ProjectTask {
  id: number;
  projectID?: number;
  title?: string;
  status?: number;
  assignedResourceID?: number | null;
  endDateTime?: string | null;
}

// Projektphase (REST-Entität `Phases`, Filter `projectID`; verifiziert 2026-06-12).
// `parentPhaseID` verweist auf eine Eltern-Phase (Unterphasen).
export interface ProjectPhase {
  id: number;
  projectID?: number;
  title?: string;
  startDate?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
  parentPhaseID?: number | null;
}

// Zusätzlicher Mitarbeiter eines Tickets (eigener Objekt-Endpoint
// TicketSecondaryResources; Felder verifiziert via entityInformation/fields
// 2026-06-11). resourceID + roleID sind beim Anlegen Pflicht.
export interface TicketSecondaryResource {
  id: number;
  ticketID?: number;
  resourceID?: number;
  roleID?: number;
}

export interface TimeEntry {
  id: number;
  ticketID?: number | null;
  resourceID?: number;
  roleID?: number | null;
  dateWorked?: string;
  startDateTime?: string | null;
  endDateTime?: string | null;
  hoursWorked?: number;
  hoursToBill?: number;
  summaryNotes?: string;
  internalNotes?: string;
  isNonBillable?: boolean;
  billingCodeID?: number | null;
  contractID?: number | null;
  showOnInvoice?: boolean;
}

export interface Company {
  id: number;
  companyName?: string;
  companyType?: number;
  isActive?: boolean;
  // Anschrift/Telefon fürs Kontextpanel (Feldnamen verifiziert 2026-06-03).
  address1?: string;
  address2?: string;
  city?: string;
  postalCode?: string;
  state?: string;
  phone?: string;
  webAddress?: string | null;
}

export interface Contact {
  id: number;
  firstName?: string;
  lastName?: string;
  emailAddress?: string;
  companyID?: number;
  isActive?: boolean | number;
  // Opt-Out: bekommt der Kontakt E-Mail-Benachrichtigungen? (in B09 verifiziert)
  receivesEmailNotifications?: boolean;
  // Lesend für das Kontaktpanel (Feldnamen verifiziert 2026-06-03).
  phone?: string;
  mobilePhone?: string;
  title?: string;
}

export interface Resource {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  userName?: string;
}

// ConfigurationItem (Device): Titel/Nummer in B09 verifiziert; Detailfelder
// (Seriennummer/Standort/Installation/Garantie) verifiziert 2026-06-03.
export interface ConfigurationItem {
  id: number;
  referenceTitle?: string;
  referenceNumber?: string;
  serialNumber?: string;
  location?: string;
  installDate?: string | null;
  warrantyExpirationDate?: string | null;
}

// Ticket-Anhang (Metadaten; verifiziert 2026-06-03). `data` (base64) wird NUR
// beim Einzelabruf /TicketAttachments/{id} befüllt, nicht in der Liste.
export interface TicketAttachment {
  id: number;
  title?: string;
  fullPath?: string; // Dateiname inkl. Endung
  contentType?: string;
  fileSize?: number;
  attachDate?: string;
  attachmentType?: string;
  publish?: number;
  ticketID?: number;
  parentID?: number;
  data?: string | null;
}

// Aufbereitete Picklists (nur aktive Werte) für die UI-Anzeige.
export interface PicklistEntry {
  value: number;
  label: string;
}
export type Picklist = PicklistEntry[];

// Abhängige Picklist-Werte tragen den Verweis auf den Elternwert (parentValue).
export interface SubPicklistEntry extends PicklistEntry {
  parentValue: number | null;
}
export type SubPicklist = SubPicklistEntry[];

export interface TicketPicklists {
  status: Picklist;
  priority: Picklist;
  queue: Picklist;
  sla: Picklist;
  source: Picklist; // Quelle (lesend)
  ticketType: Picklist; // Typ (lesend)
  issueType: Picklist; // Kategorie
  subIssueType: SubPicklist; // Unterkategorie (abhängig von issueType)
}

// Projekt-Picklisten für Anzeige/Bearbeitung (eigene Listen der Projects-Entität).
export interface ProjectPicklists {
  status: Picklist;
  projectType: Picklist;
}
