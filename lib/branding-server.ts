import "server-only";

import { ORG_NAME } from "@/lib/branding";
import { companies } from "@/lib/autotask/entities/companies";

// Server-seitige Auflösung des Firmennamens fürs Branding.
// Reihenfolge:
//   1. Env-Override NEXT_PUBLIC_ORG_NAME (explizit gesetzt → gewinnt immer).
//   2. Eigene Firma aus Autotask (companyID 0), 24 h gecacht → automatisch korrekt,
//      ohne Hartkodieren; macht das Repo portabel (jeder Tenant sieht seinen Namen).
//   3. Fallback ORG_NAME ("Acme GmbH"), falls Autotask nicht erreichbar/leer.
// Fehler werden bewusst geschluckt – Branding darf nie eine Seite crashen.
export async function getOrgName(): Promise<string> {
  const override = process.env.NEXT_PUBLIC_ORG_NAME?.trim();
  if (override) return override;
  try {
    const name = await companies.ownName();
    if (name) return name;
  } catch {
    // Autotask nicht erreichbar → Fallback unten.
  }
  return ORG_NAME;
}

// Absender-/Signaturname in der Kunden-Chat-Mail, z. B. "SSIG-IT GmbH Service Desk".
export async function getMailSenderName(): Promise<string> {
  return `${await getOrgName()} Service Desk`;
}
