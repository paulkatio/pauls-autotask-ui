// Branding der App (Sidebar, Login, Web-App-Manifest, Mail-Signatur).
// Default = generische Beispielfirma, damit das Repo ohne Bezug zu einer realen
// Firma portierbar bleibt. Die eigene Marke wird über NEXT_PUBLIC_ORG_NAME gesetzt
// (NEXT_PUBLIC_* → zur Build-Zeit eingebettet, sowohl client- als auch serverseitig
// lesbar). Beispiel: NEXT_PUBLIC_ORG_NAME=SSIG-IT
export const ORG_NAME = process.env.NEXT_PUBLIC_ORG_NAME?.trim() || "Acme GmbH";

// Absender-/Signaturname in der Kunden-Chat-Mail (Resend), z. B. "Acme GmbH Service Desk".
export const MAIL_SENDER_NAME = `${ORG_NAME} Service Desk`;
