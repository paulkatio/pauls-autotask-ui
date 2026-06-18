<div align="center">

# Autotask UI

**Eine fokussierte, mobile-first Oberfläche für Kaseya Autotask PSA — installierbar als App auf dem Handy, stark auf dem Desktop.**

Backend-for-Frontend: alle Autotask-Credentials bleiben serverseitig. Internes Werkzeug, UI auf Deutsch.

[![CI](https://github.com/paulkatio/pauls-autotask-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/paulkatio/pauls-autotask-ui/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev)
[![Tailwind v4](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![PWA](https://img.shields.io/badge/PWA-installierbar-5A0FC8?logo=pwa&logoColor=white)](#mobile--pwa)

[English](README.md) · **Deutsch**

</div>

---

<p align="center">
  <img src="docs/screenshot-desktop.png" alt="Desktop – Dashboard mit KPI-Kacheln, Team-Chart und Arbeitsliste" width="100%">
</p>

<p align="center">
  <img src="docs/screenshot-mobile-dashboard.png" alt="Handy – Dashboard mit KPI-Kacheln, Team-Chart und Tab-Leiste" width="40%">
  &nbsp;&nbsp;
  <img src="docs/screenshot-mobile-tickets.png" alt="Handy – Ticketliste als Karten" width="40%">
</p>

<div align="center"><sub>Oben Desktop, unten dasselbe Werkzeug auf dem Handy – als PWA installierbar. Demo-Daten.</sub></div>

---

## Warum

Die klassische Autotask-Oberfläche ist umfangreich, aber zäh – besonders unterwegs. Diese App bildet nur das ab, was Techniker und Service-Desk täglich wirklich brauchen, und macht es schnell: ein aufgeräumtes Dashboard, Ticketlisten mit Bulk-Aktionen, ein fokussiertes Ticketdetail mit Kunden-Chat – auf dem Desktop wie auf dem Handy. Der Browser spricht ausschließlich mit internen `/api`-Routen; die Autotask-Zugangsdaten verlassen den Server nie.

## Features

- **Dashboard** — „Meine Tickets", KPI-Kacheln, Team-Chart und Arbeitsliste auf einen Blick.
- **Ticketlisten** — meine / Team / Pool / „Ball bei mir", mit Filtern, Spalten-Sortierung und Bulk-Aktionen (inkl. Zusammenführen).
- **Ticketdetail** — Inline-Edit der Felder, Kunden-Chat (TicketNotes), Anhänge und Checklisten.
- **Zeiterfassung** — schlanke Stoppuhr und „Zeit erfassen", Tages- und Wochenansicht mit Summen.
- **Projekte, Firmen und Kontakte** — Listen, Detailseiten, Kundenakte mit Geräten und Verträgen.
- **Globale Suche** — Spotlight (`⌘ / Strg + K`) über Tickets, Firmen und Kontakte.
- **Hell und Dunkel** — automatisch über semantische Tokens, mit Theme-Umschalter.

## Mobile & PWA

Gebaut für das Handy – nicht „Desktop, nur kleiner":

- **Installierbar** als PWA (`display: standalone`) — landet mit eigenem, schönem Icon auf dem Homescreen und startet ohne Browser-Leiste.
- **Echte Mobile-Layouts** — Karten statt gequetschter Tabellen, untere Tab-Leiste, Safe-Area für Notch und Home-Indicator, tastatur-bewusste Höhen (`dvh`) für den Chat.
- **Touch-Ziele ab 44 px** unter `sm`, getestet von 320 px bis Ultrawide — kein horizontales Scrollen.
- **Desktop voll ausgereizt** — feste Sidebar, Pop-out-Fenster, dichte Tabellen mit umsortierbaren Spalten.
- **Bewusst ohne Service-Worker** — ein Live-Daten-Werkzeug gegen die Autotask-API; veraltete Caches wären schädlich.

## Tech-Stack

**Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript** · **Tailwind v4** · **shadcn/ui** (einzige UI-Library) · Charts über shadcn-`Chart` (Recharts) · `next-themes` · `@phosphor-icons/react` · **Auth.js v5** (Microsoft Entra ID) oder Mock · Tests mit **Playwright**.

## Erste Schritte

**Voraussetzungen:** [Node.js](https://nodejs.org) 22.x und npm.

```bash
git clone https://github.com/paulkatio/pauls-autotask-ui.git
cd pauls-autotask-ui
npm install

cp .env.example .env.local        # dann die Werte ausfüllen (siehe Hinweis unten)
npm run dev                       # http://localhost:3000
```

Auf der Login-Seite einen Demo-Benutzer anklicken (Mock-Login) – fertig.

> [!NOTE]
> Die App rendert **Live-Daten** aus der Autotask-REST-API. `.env.local` braucht daher gültige `AUTOTASK_*`-Zugangsdaten plus `AUTH_MODE=mock`. Ohne sie startet die App zwar, die Listen bleiben aber leer. Vollständige Liste, Quoting-Fallen und Deployment-Details in [`.env.example`](.env.example) und [`DEPLOY.md`](DEPLOY.md).

| Befehl | Zweck |
|--------|-------|
| `npm run dev` | Entwicklungsserver, Mock-Login per Klick |
| `npm run build` | Produktions-Build (typisiert und kompiliert) |
| `npm run typecheck` · `npm run lint` | TS-Check · ESLint (Gate in CI und Pre-Commit) |
| `npm run test:e2e` | Playwright-Smoke → [`e2e/README.md`](e2e/README.md) |

> [!TIP]
> Verbindung prüfen (read-only, druckt kein Secret):
> `node --env-file=.env.local scripts/verify-api.mjs ping`

## Konfiguration & Deployment

Alle Werte kommen zur **Laufzeit** aus der Umgebung – nie ins Image gebacken, nie committet. Vollständige Liste, Quoting-Fallen, Docker/Vercel und Entra-Redirect-URIs in [`.env.example`](.env.example) und **[`DEPLOY.md`](DEPLOY.md)**.

Kurzform: `AUTOTASK_*` (Backend) · `AUTH_MODE=mock|entra` (in Produktion zwingend explizit, **fail-closed**) · `RESEND_*` / `AUTOTASK_INBOUND_MAILBOX` (Kundenmail) · optional `UPSTASH_REDIS_REST_*` (globaler Thread-Limiter). Deployment-agnostisch: **Vercel** oder **Docker** (JWT-Session ohne DB, Route-Schutz serverseitig).

## Sicherheit

- **BFF** — Autotask-Credentials nur serverseitig; Schreibpfade pro Route feld-whitelisted; interne Fehler werden nie roh an den Browser geleakt.
- **Security-Header** — `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` und CSP (Report-Only).

> [!WARNING]
> Das Backend ist **Produktion** (kein Sandbox-Schutz). Sicherheitslücken bitte vertraulich melden: [`SECURITY.md`](SECURITY.md).

## Dokumentation

[`docs/STATE.md`](docs/STATE.md) — Stand, Architektur, Features, Env · [`docs/DECISIONS.md`](docs/DECISIONS.md) — verifizierte API-Fakten · [`DEPLOY.md`](DEPLOY.md) · [`CHANGELOG.md`](CHANGELOG.md) · Projektregeln in [`CLAUDE.md`](CLAUDE.md).

## Lizenz

[MIT](LICENSE) © 2026 Paul-Harald Katio.
