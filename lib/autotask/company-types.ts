// Kundenart (Companies.companyType) – Picklist verifiziert 2026-06-04 gegen .env.local:
// 1=Customer, 2=Lead, 3=Prospect, 4=Dead, 6=Cancellation, 7=Vendor, 8=Partner.
// Deutsche Labels (API liefert Englisch). Bewusst OHNE "server-only" (client + server).
export const COMPANY_TYPE_LABELS: Record<number, string> = {
  1: "Kunde",
  2: "Lead",
  3: "Interessent",
  4: "Inaktiv",
  6: "Kündigung",
  7: "Lieferant",
  8: "Partner",
};

// Standard-Kundenart: „Kunde" ist in der Firmenliste vorausgewählt (Paul-Feedback).
export const COMPANY_TYPE_CUSTOMER = 1;

// Reihenfolge im Kundenart-Filter (häufigste zuerst).
export const COMPANY_TYPE_ORDER = [1, 7, 8, 2, 3, 6, 4];

export function companyTypeLabel(type: number | null | undefined): string {
  return type != null ? (COMPANY_TYPE_LABELS[type] ?? `Art ${type}`) : "—";
}
