<div align="center">

# 📋 Autotask UI

**Eine fokussierte, mobile-first Oberfläche für Kaseya Autotask PSA — installierbar als App aufs Handy, perfekt auf dem Desktop.**

*Backend-for-Frontend: alle Autotask-Credentials bleiben serverseitig. Internes Werkzeug, UI auf Deutsch.*

[![CI](https://github.com/paulkatio/pauls-autotask-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/paulkatio/pauls-autotask-ui/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React 19](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev)
[![Tailwind v4](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![PWA](https://img.shields.io/badge/PWA-installierbar-5A0FC8?logo=pwa&logoColor=white)](#-mobile--pwa-der-kern)

</div>

---

<!-- 📸 SCREENSHOTS — Dateien bitte unter docs/ ablegen (siehe Hinweis am Ende). -->

<p align="center">
  <img src="docs/screenshot-desktop.png" alt="Desktop – Dashboard mit KPI-Kacheln, Team-Chart und Arbeitsliste" width="100%">
</p>

<p align="center">
  <img src="docs/screenshot-mobile-dashboard.png" alt="Handy – Dashboard mit KPI-Kacheln, Team-Chart und Tab-Leiste" width="40%">
  &nbsp;&nbsp;
  <img src="docs/screenshot-mobile-tickets.png" alt="Handy – Ticketliste als Karten" width="40%">
</p>

<div align="center"><sub>Oben: Desktop. Unten: dieselbe App auf dem Handy – als PWA installierbar. (Demo-Daten.)</sub></div>

---

## ✨ Was es kann

- 📊 **Dashboard** — „Meine Tickets", KPI-Kacheln, Team-Chart, Arbeitsliste auf einen Blick.
- 🎫 **Ticketlisten** — meine / Team / Pool / „Ball bei mir", mit Filtern, Spalten-Sortierung und Bulk-Aktionen (inkl. Zusammenführen).
- 💬 **Ticketdetail** — aufgeräumt, Inline-Edit der Felder, Kunden-Chat (TicketNotes), Anhänge, Checklisten.
- ⏱️ **Zeiterfassung** — schlanke Stoppuhr + „Zeit erfassen", Tages-/Wochenansicht mit Summen.
- 📁 **Projekte, Firmen & Kontakte** — Listen, Detailseiten, Kundenakte mit Geräten/Verträgen.
- 🔍 **Globale Suche** — Spotlight (`⌘/Strg + K`) über Tickets, Firmen, Kontakte.
- 🌗 **Hell & Dunkel** — automatisch über semantische Tokens, inkl. Theme-Umschalter.

## 📱 Mobile & PWA (der Kern)

Diese App ist **für das Handy gebaut** — nicht „Desktop, nur kleiner":

- 🏠 **Installierbar** als PWA (`display: standalone`) — landet als „Tickets" mit eigenem Icon auf dem Homescreen, startet ohne Browser-Leiste.
- 📐 **Echte Mobile-Layouts** — Karten statt gequetschter Tabellen, untere Tab-Leiste, Safe-Area für Notch/Home-Indicator, tastatur-bewusste Höhen (`dvh`) für den Chat.
- 👆 **Touch-Ziele ≥ 44 px** unter `sm`, getestet von **320 px** bis Ultrawide — kein horizontales Scrollen, kein Überlauf.
- 🖥️ **Desktop voll ausgereizt** — feste Sidebar, Pop-out-Fenster, dichte Tabellen mit umsortierbaren Spalten.
- ⚡ **Bewusst ohne Service-Worker/Offline** — es ist ein Live-Daten-Werkzeug gegen die Autotask-API; veraltete Caches wären schädlich.

## 🧱 Stack

**Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript** · **Tailwind v4** · **shadcn/ui** (einzige UI-Lib) · Charts über shadcn-`Chart` (Recharts) · `next-themes` · `lucide-react` · **Auth.js v5** (Microsoft Entra ID) oder Mock · Tests: **Playwright**.

## 🚀 Schnellstart

```bash
npm install
cp .env.example .env.local        # füllen (siehe .env.example + DEPLOY.md)
npm run dev                       # → http://localhost:3000  (Mock-Login per Klick)
```

| Befehl | Zweck |
|--------|-------|
| `npm run dev` | Entwicklungsserver, Mock-Login per Klick |
| `npm run build` | Produktions-Build (typisiert + kompiliert) |
| `npm run typecheck` · `npm run lint` | TS-Check · ESLint (Gate: CI + Pre-Commit) |
| `npm run test:e2e` | Playwright-Smoke → [`e2e/README.md`](e2e/README.md) |

> 🔌 Verbindung prüfen (read-only, druckt kein Secret):
> `node --env-file=.env.local scripts/verify-api.mjs ping`

## ⚙️ Konfiguration & Deployment

Alle Werte kommen zur **Laufzeit** aus der Umgebung — nie ins Image gebacken, nie committet. Vollständige Liste, Quoting-Fallen, Docker/Vercel und Entra-Redirect-URIs in [`.env.example`](.env.example) und **[`DEPLOY.md`](DEPLOY.md)**.

Kurzform: `AUTOTASK_*` (Backend) · `AUTH_MODE=mock|entra` (in Prod zwingend explizit, **fail-closed**) · `RESEND_*` / `AUTOTASK_INBOUND_MAILBOX` (Kundenmail) · optional `UPSTASH_REDIS_REST_*` (globaler Thread-Limiter). Deployment-agnostisch: **Vercel** oder **Docker** (JWT-Session ohne DB, Route-Schutz serverseitig).

## 🔒 Sicherheit

- 🛡️ **BFF** — Autotask-Credentials nur serverseitig; Schreibpfade pro Route feld-whitelisted; interne Fehler werden nie roh an den Browser geleakt.
- 🧷 **Header** — `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` + CSP (Report-Only).
- ⚠️ Das Backend ist **Produktion** (kein Sandbox-Schutz). Lücken vertraulich melden: [`SECURITY.md`](SECURITY.md).

## 📚 Doku

[`docs/STATE.md`](docs/STATE.md) — Stand, Architektur, Features, Env · [`docs/DECISIONS.md`](docs/DECISIONS.md) — verifizierte API-Fakten · [`DEPLOY.md`](DEPLOY.md) · [`CHANGELOG.md`](CHANGELOG.md) · Projektregeln: [`CLAUDE.md`](CLAUDE.md).

## 📄 Lizenz

[MIT](LICENSE) © 2026 Paul-Harald Katio.
