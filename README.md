# Autotask UI

> A focused, modern web UI for Kaseya Autotask PSA — a Backend-for-Frontend that keeps
> all API credentials server-side. *(German-language internal tool.)*

[![CI](https://github.com/paulkatio/pauls-autotask-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/paulkatio/pauls-autotask-ui/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/paulkatio/pauls-autotask-ui?sort=semver&color=success)](https://github.com/paulkatio/pauls-autotask-ui/releases)
[![Last commit](https://img.shields.io/github/last-commit/paulkatio/pauls-autotask-ui)](https://github.com/paulkatio/pauls-autotask-ui/commits/master)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![shadcn/ui](https://img.shields.io/badge/UI-shadcn%2Fui-black)](https://ui.shadcn.com)

Interne Web-App als fokussierte, modernere Alternative zur klassischen Autotask-
Oberfläche – nur was Techniker und Service-Desk täglich brauchen: Dashboard,
Ticketlisten mit Bulk-Aktionen, aufgeräumtes Ticketdetail mit Chat-Sidebar,
Zeiterfassung, Firmen-/Kontaktverwaltung und eine schnelle globale Suche.

Die App ist ein **Backend-for-Frontend (BFF)** vor der Autotask REST API: Der Browser
spricht ausschließlich mit internen `/api`-Routen dieser App; die Autotask-Zugangsdaten
bleiben **immer** serverseitig.

![Autotask UI – Dashboard](docs/screenshot.png)

> 📖 **Einstieg für Mensch & KI:** [`docs/STATE.md`](docs/STATE.md) – Stand, Architektur,
> Features, Weichen, Cutover-Lücken, alles selbsterklärend.

---

## Inhalt

[Features](#features) · [Tech-Stack](#tech-stack) · [Architektur](#architektur) ·
[Schnellstart](#schnellstart) · [Konfiguration](#konfiguration) ·
[Deployment](#deployment) · [Sicherheit](#sicherheit) · [Tests](#tests) ·
[Projektstruktur](#projektstruktur) · [Versionierung](#versionierung) ·
[Doku](#dokumentation) · [Lizenz](#lizenz)

## Features

Schnell, fokussiert, **mobile-first**: die tägliche Arbeit von Technikern und Service-Desk
in einer aufgeräumten Oberfläche statt in der schwergewichtigen Autotask-Maske – vom
Smartphone bis zum Breitbild dieselbe App.

- **📱 Perfekt am Smartphone (Mobile First).** Jede Liste, jedes Detail, jeder Dialog ist
  für den Touch gebaut. Ticket-, Firmen- und Kontaktlisten werden auf dem Handy zu
  übersichtlichen **Karten** (kein Querscrollen), KPI-Kacheln im **2×2-Raster**, große
  Touch-Navigation, der **Chat immer griffbereit**. Tabellen erst ab Tablet/Desktop.
- **⚡ Dashboard auf einen Blick.** KPI-Kacheln (meine offenen / Pool / Ball liegt bei
  mir), „Tickets pro Mitarbeiter" als Diagramm (auf dem Handy als Liste) und „heute
  bearbeitet" mit Zeitraum-Filter (Heute / 3 / 7 Tage).
- **🎯 Ticketlisten, die mitdenken.** Server-seitige Filter, Volltextsuche,
  **Bulk-Aktionen mit Undo** (Status/Priorität/Queue/Zuweisung) und **per Drag & Drop
  umsortierbare Spalten** (gemerkt pro Gerät).
- **💬 Ticketdetail mit echtem Kunden-Chat.** Inline-Edit aller Kernfelder, **Chat-Sidebar
  mit Kundenmail via Resend** (Senden legt die Notiz an *und* mailt; Antworten threaden
  über die Ticketnummer automatisch zurück ans Ticket), **Zeiterfassung + Stoppuhr**,
  interne Notizen, Anhänge.
- **🔎 Globale Blitz-Suche.** Spotlight-Palette (`Cmd/Ctrl+K`) sucht Tickets, Firmen und
  Kontakte gleichzeitig; dazu eine `/search`-Seite mit „Mehr laden" und Gesamtzahl.
- **🏢 Firmen & Kontakte** mit Suche/Filter und kompakter Kundenakte.
- **🌗 Hell & Dunkel** automatisch über semantische Tokens – kein hartes Theming, AA-Kontrast.
- **🔒 Sicher per Design (BFF).** Autotask-Zugangsdaten bleiben **immer** serverseitig;
  der Browser sieht nur interne `/api`-Routen, Schreibpfade sind pro Feld whitelisted.
- **🔑 Login nach Wahl.** Lokaler Mock **oder** Microsoft Entra ID (inkl. Profilbild aus
  Microsoft Graph) – Umschalten kostet **eine** Umgebungsvariable.

## Tech-Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 ·
**shadcn/ui** (und sonst keine UI-Library) · Charts über shadcn-`Chart` (Recharts) ·
`next-themes` (Light/Dark/System) · Icons `lucide-react` · Auth.js v5 (Entra ID) ·
Tests: Playwright.

## Architektur

```mermaid
flowchart TD
    B["Browser · Client Components"]
    SC["Server Components"]
    R["app/api/**/route.ts<br/>getSession + Feld-Whitelist"]
    E["lib/autotask/entities/entity.ts<br/>dünne Wrapper"]
    C["lib/autotask/client.ts · server-only<br/>Limiter 2/Entität · 429-Backoff · Paging"]
    AT["Autotask REST API"]

    B -->|"fetch('/api/...')"| R
    SC -->|"direkter Aufruf"| E
    R --> E
    E --> C
    C -->|"Creds nur aus process.env"| AT
```

Details: [`docs/STATE.md`](docs/STATE.md) (§3 Datenfluss) und
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Schnellstart

```bash
# 1. Abhängigkeiten
npm install

# 2. Zugangsdaten: Vorlage kopieren und füllen (siehe Konfiguration)
cp .env.example .env.local

# 3. Entwicklung (Mock-Login per Klick als Demo-User)
npm run dev            # http://localhost:3000
```

| Befehl | Zweck |
|--------|-------|
| `npm run dev` | Entwicklungsserver |
| `npm run build` | Produktions-Build (typisiert + kompiliert) |
| `npm run start` | Produktions-Server (nach Build) |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright-Smoke-Suite (einmalig: `npx playwright install chromium`) |

> **Verbindung prüfen:** `node --env-file=.env.local scripts/verify-api.mjs ping`
> testet die Autotask-Anbindung gegen deine Sandbox.

## Konfiguration

Alle Werte werden zur **Laufzeit** aus der Umgebung gelesen (nie ins Image gebacken,
nie committet). Vorlage: [`.env.example`](.env.example).

| Variable | Nötig | Zweck |
|---|---|---|
| `AUTH_MODE` | immer | `mock` (lokaler Login) oder `entra` (Microsoft Entra ID) |
| `NEXT_PUBLIC_ORG_NAME` | optional | Eigener Firmen-/Markenname (Sidebar, Login, Manifest, Mail-Signatur); Default `Acme GmbH` |
| `AUTOTASK_BASE_URL` | immer | Zone-Endpoint, z. B. `https://webservicesX.autotask.net/ATServicesRest/V1.0` |
| `AUTOTASK_API_USERNAME` | immer | API-User |
| `AUTOTASK_API_SECRET` | immer | API-Secret (Sonderzeichen → in `.env.local` in **einfache** Quotes) |
| `AUTOTASK_INTEGRATION_CODE` | immer | Integration-Code |
| `AUTH_SECRET` | bei `entra` | `openssl rand -base64 32` (JWT-Signatur) |
| `ENTRA_CLIENT_ID` | bei `entra` | Application (client) ID |
| `ENTRA_CLIENT_SECRET` | bei `entra` | Client-Secret-Wert |
| `ENTRA_TENANT_ID` | bei `entra` | Directory (tenant) ID → tenant-spezifischer Issuer |
| `AUTH_URL` | bei `entra` | öffentliche https-Domain (Redirects/Callback) |
| `AUTH_TRUST_HOST` | bei `entra` (Non-Vercel) | `true` (hinter Reverse-Proxy) |
| `ENTRA_EMAIL_LOOSE_MATCH` | nur Sandbox | `1` = toleranter E-Mail→Resource-Abgleich (`+psasandbox`-Tag); in **Prod weglassen** |
| `RESEND_API_KEY` | für Chat-Mail | Resend-API-Key (Kundenmail beim Chat-Senden) |
| `RESEND_FROM` | für Chat-Mail | Absender auf verifizierter Resend-Domain, z. B. `Acme Service Desk <service@example.com>` |
| `AUTOTASK_INBOUND_MAILBOX` | für Chat-Mail | Autotask-Eingangspostfach = `Reply-To` (Antworten laufen als TicketNote zurück) |

> **Entra-Namen:** Der Provider wird in [`lib/auth/authjs.ts`](lib/auth/authjs.ts) **explizit**
> aus `ENTRA_CLIENT_ID/_SECRET/_TENANT_ID` konfiguriert — **nicht** aus den Auth.js-
> Defaults `AUTH_MICROSOFT_ENTRA_ID_*`. **Kundenmail:** Eine Chat-Nachricht legt die
> TicketNote an **und** sendet via Resend (`Reply-To` = Inbound-Mailbox); ohne
> Resend-Konfig bleibt der alte Autotask-Workflow-Pfad aktiv.

## Deployment

Deployment-agnostisch: **Vercel** *oder* **Docker/Self-Hosting**. JWT-Session (keine DB),
Route-Schutz server-seitig (kein `middleware.ts`), `output: "standalone"`. Ausführliche
Anleitung + Entra-Redirect-URIs: [`DEPLOY.md`](DEPLOY.md).

### Vercel

1. Repo importieren (Framework-Preset **Next.js**, Build/Output automatisch).
2. Env-Variablen (oben) im Projekt setzen (Production/Preview).
3. Im Entra-Modus die Redirect-URI ergänzen:
   `https://<projekt>.vercel.app/api/auth/callback/microsoft-entra-id`.

### Docker — Schritt für Schritt (lokal verifiziert)

> Funktioniert auf jedem Rechner/Server mit **Docker**. In ~3 Minuten läuft die App.
> Das Image enthält **keine** Secrets – die kommen erst beim Start über `--env-file`.

**Voraussetzung:** Docker ist installiert und läuft (`docker --version` muss eine Version zeigen).

**1. Eine Datei `prod.env` anlegen** (neben dem Projekt). ⚠️ **Keine Anführungszeichen um
Werte** – `docker --env-file` nimmt sie wörtlich und macht damit z. B. das API-Secret kaputt.

Einfachste Variante zum Ausprobieren (lokaler Login per Klick, **kein** Microsoft nötig):

```env
AUTH_MODE=mock
AUTH_SECRET=ersetze-durch-32-zufaellige-zeichen
AUTOTASK_BASE_URL=https://webservicesNN.autotask.net/ATServicesRest/V1.0
AUTOTASK_API_USERNAME=dein-api-user
AUTOTASK_API_SECRET=dein-api-secret-OHNE-anfuehrungszeichen
AUTOTASK_INTEGRATION_CODE=dein-integration-code
```

Für **echten Microsoft-Login** stattdessen/zusätzlich:

```env
AUTH_MODE=entra
AUTH_TRUST_HOST=true               # PFLICHT im Container, sonst "UntrustedHost" beim Login
AUTH_URL=http://localhost:3000     # lokal so; in Prod deine echte https-Domain
ENTRA_CLIENT_ID=...
ENTRA_CLIENT_SECRET=...
ENTRA_TENANT_ID=...
```

(`AUTH_SECRET` per `openssl rand -base64 32` erzeugen. Alle Variablen: siehe
[Konfiguration](#konfiguration).)

**2. Image bauen:**

```bash
docker build -t autotask-ui .
# Optional eigene Marke einbacken (sonst steht "Acme GmbH" in Sidebar/Login):
# docker build -t autotask-ui --build-arg NEXT_PUBLIC_ORG_NAME="Deine Firma" .
```

**3. Container starten:**

```bash
docker run -d --name autotask-ui \
  --env-file ./prod.env \
  -p 127.0.0.1:3000:3000 \
  --restart unless-stopped \
  autotask-ui
```

**4. Öffnen:** http://localhost:3000 → einloggen. Fertig.

Health-Check: `curl -I http://127.0.0.1:3000/login` → `HTTP 200`.

**Verwalten:**

```bash
docker logs -f autotask-ui     # Logs ansehen (bei Problemen zuerst hier schauen)
docker rm -f autotask-ui       # Container stoppen + entfernen
# Update: git pull → docker build … → docker rm -f autotask-ui → docker run … (Schritt 2+3)
```

#### Häufige Stolpersteine

| Symptom | Ursache / Fix |
|---|---|
| Login → **„Server error / UntrustedHost"** | `AUTH_TRUST_HOST=true` in `prod.env` fehlt (im Container Pflicht). |
| Autotask-Login schlägt fehl (401) | Anführungszeichen um Werte in `prod.env` → **entfernen** (`--env-file` mag keine Quotes). |
| Marke zeigt weiter „Acme GmbH" | `NEXT_PUBLIC_ORG_NAME` wirkt nur **beim Build** → als `--build-arg` setzen, nicht zur Laufzeit. |
| `port is already allocated` | Port 3000 belegt (z. B. `npm run dev`) → anderen Host-Port nehmen: `-p 127.0.0.1:3001:3000`. |
| Microsoft-Login bricht ab | Redirect-URI in der Entra-App muss exakt zu `AUTH_URL` passen: `<AUTH_URL>/api/auth/callback/microsoft-entra-id`. |

**Produktion hinter Reverse-Proxy:** Container nur an `127.0.0.1` binden, öffentlich macht
ihn ein Proxy mit TLS. Beispiel **Caddy** (auto-HTTPS) + Prod-Details:
[`DEPLOY.md`](DEPLOY.md) · [`Caddyfile.example`](Caddyfile.example).

> Funktioniert auf jedem Docker-fähigen Host (eigener VPS, Hetzner, etc.). Im
> Entra-Modus zusätzlich `AUTH_URL=https://<domain>` und `AUTH_TRUST_HOST=true` setzen
> und die Redirect-URI in der Entra-App ergänzen.

## Sicherheit

- **Keine Secrets im Repo** (`.env*` gitignored; nur `.env.example` mit Platzhaltern).
- **BFF:** Autotask-/Auth-Creds bleiben server-seitig (`process.env`), nie im Client-Bundle
  oder in API-Antworten. Schreibpfade pro Route auf eine Feld-Whitelist begrenzt.
- **Container** ohne Secrets, läuft als non-root; Env erst zur Laufzeit.
- Sicherheitslücken melden: [`SECURITY.md`](SECURITY.md).

## Tests

Playwright-Smoke-Suite über die Kernpfade (Mock-Auth gegen die Sandbox). Details:
[`e2e/README.md`](e2e/README.md). Der einzige Schreibtest lässt sich per
`E2E_SKIP_WRITE_TESTS=1` abschalten.

## Projektstruktur

```
app/(app)/        geschützte App-Shell + Seiten (Dashboard, Tickets, Firmen, Kontakte, Suche, Zeiten)
app/api/          BFF-Routen (Whitelist + getSession)
components/       Feature-Slices + components/ui (vendored shadcn)
lib/auth/         Session + Provider (Mock | Entra, via AUTH_MODE)
lib/autotask/     generischer REST-Client + dünne Entity-Wrapper
hooks/            z. B. use-column-order (Spalten-Drag&Drop)
e2e/              Playwright-Smoke
docs/             STATE, DECISIONS, BACKLOG, BLUEPRINT, ARCHITECTURE, PHASE-0
```

## Versionierung

Dieses Projekt folgt **[Semantic Versioning](https://semver.org/lang/de/)**
(`MAJOR.MINOR.PATCH`) und **[Conventional Commits](https://www.conventionalcommits.org/de/)**
(`feat:`, `fix:`, `docs:` …). Nennenswerte Änderungen stehen im
**[Changelog](CHANGELOG.md)**; veröffentlichte Stände als
**[GitHub-Releases](https://github.com/paulkatio/pauls-autotask-ui/releases)** mit
`vX.Y.Z`-Tags. Aktuell **Pre-1.0** (`0.x`) — bis zum Produktiv-Cutover kann sich die
Oberfläche noch ändern.

## Dokumentation

- **[`docs/STATE.md`](docs/STATE.md)** — Stand, Architektur, Features, Weichen, Cutover (Start hier).
- [`CHANGELOG.md`](CHANGELOG.md) — versionierte Änderungshistorie (Keep a Changelog).
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — verifizierte API-Fakten + Entscheidungs-Historie.
- [`docs/BACKLOG.md`](docs/BACKLOG.md) · [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md) ·
  [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`DEPLOY.md`](DEPLOY.md) ·
  [`CONTRIBUTING.md`](CONTRIBUTING.md).

> **Hinweis:** Beispiel-/Verifikationsdaten in den Docs (Firmen, Kontakte, Mock-User) sind
> **anonymisiert** (Platzhalter). Die Mock-User-Resource-IDs zeigen auf eine Autotask-
> Sandbox – beim Anschluss an einen anderen Mandanten anpassen.

## Lizenz

[MIT](LICENSE) © 2026 Paul-Harald Katio.
