# docs/ — Planungs- und Gedächtnisdokumente

Der Code liegt im Projekt-Root (siehe [`../README.md`](../README.md)). Dieser Ordner ist
das Gedächtnis des Projekts.

**Einstieg für eine KI ohne Chat-Kontext: [`STATE.md`](STATE.md) zuerst lesen** – Stand,
Architektur, Features, Weichen, Env, Cutover-Lücken, alles selbsterklärend.

## Was wo steht

- **[`STATE.md`](STATE.md)** — autoritativer Projekt-Stand & Handoff (Start hier).
- `../CLAUDE.md` — verbindliche Regeln (Stack, Verbote, Auth-Architektur,
  Arbeitsdisziplin). Wird bei jedem Claude-Code-Start gelesen.
- [`DECISIONS.md`](DECISIONS.md) — verifizierte API-Fakten + Entscheidungs-Historie
  (chronologisch, groß). Das Detailgedächtnis; `STATE.md` ist die Zusammenfassung.
- [`BACKLOG.md`](BACKLOG.md) — Aufgaben/Status je Item (B00–… + Folge-Slices).
- [`BLUEPRINT.md`](BLUEPRINT.md) — fachlicher Bauplan (Datenmodell, Routen, UX, API-Mapping).
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — Repo-Karte (Verzeichnisse, Datenfluss, Prinzipien).
- [`PHASE-0-API-VERIFICATION.md`](PHASE-0-API-VERIFICATION.md) — historisch: die initiale
  API-Verifikation (abgeschlossen; Befunde in `DECISIONS.md`).
- [`../DEPLOY.md`](../DEPLOY.md) — Deployment (Docker+Caddy oder Vercel) + Env-Variablen.

## Disziplin (Kurz)

Pro Arbeits-Slice: gegen die Sandbox verifizieren → `npm run build` grün → Browser
Hell/Dunkel/Mobile → EIN kleiner Commit → `DECISIONS.md`/`BACKLOG.md` nachziehen.
**Schreibtests nur** an der Firma „Acme GmbH Sandbox" (`companyID 0`) / Kontakt
Paul-Harald Katio (`contactID 30684646`), Test-Titel `ZZZ TEST`. Nichts „fertig"
behaupten ohne echten Test.
