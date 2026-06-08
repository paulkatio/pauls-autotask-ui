// Branding der App (Sidebar, Login, Web-App-Manifest, Mail-Signatur).
// Default = generische Beispielfirma, damit das Repo ohne Bezug zu einer realen
// Firma portierbar bleibt. Die eigene Marke wird über NEXT_PUBLIC_ORG_NAME gesetzt
// (NEXT_PUBLIC_* → zur Build-Zeit eingebettet, sowohl client- als auch serverseitig
// lesbar). Beispiel: NEXT_PUBLIC_ORG_NAME=SSIG-IT
export const ORG_NAME = process.env.NEXT_PUBLIC_ORG_NAME?.trim() || "Acme GmbH";

// Hinweis: Der Mail-Absender-/Signaturname wird server-seitig dynamisch aufgelöst
// (Companies/0 → Env-Override → ORG_NAME) in lib/branding-server.ts → getMailSenderName().
