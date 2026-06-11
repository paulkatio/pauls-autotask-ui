# Autotask UI

> Fokussierte, moderne Web-UI für Kaseya Autotask PSA — ein **Backend-for-Frontend**,
> das alle API-Credentials serverseitig hält. *(Internes Werkzeug, UI auf Deutsch.)*

[![CI](https://github.com/paulkatio/pauls-autotask-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/paulkatio/pauls-autotask-ui/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

Schlanke Alternative zur klassischen Autotask-Oberfläche – nur was Techniker/Service-Desk
täglich brauchen: Dashboard, Ticketlisten mit Bulk-Aktionen, aufgeräumtes Ticketdetail mit
Kunden-Chat, Zeiterfassung, Projekte, Firmen/Kontakte, globale Suche. **Mobile-first.** Der
Browser spricht nur mit internen `/api`-Routen; Autotask-Zugangsdaten bleiben **immer**
serverseitig.

> 📖 **Einstieg für Mensch & KI:** [`docs/STATE.md`](docs/STATE.md) — Stand, Architektur,
> Features, Weichen, Env, offene Punkte. Verifizierte API-Fakten: [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 · **shadcn/ui**
(einzige UI-Lib) · Charts über shadcn-`Chart` (Recharts) · `next-themes` · `lucide-react` ·
Auth.js v5 (Entra ID) **oder** Mock · Tests: Playwright.

## Schnellstart

```bash
npm install
cp .env.example .env.local       # füllen (siehe .env.example + DEPLOY.md)
npm run dev                       # http://localhost:3000
```

| Befehl | Zweck |
|--------|-------|
| `npm run dev` | Entwicklungsserver (Mock-Login per Klick) |
| `npm run build` | Produktions-Build (typisiert + kompiliert) |
| `npm run typecheck` / `npm run lint` | TS-Check / ESLint |
| `npm run test:e2e` | Playwright-Smoke (`docs`→ [`e2e/README.md`](e2e/README.md)) |

> Verbindung prüfen (read-only, druckt kein Secret):
> `node --env-file=.env.local scripts/verify-api.mjs ping`

## Konfiguration & Deployment

Alle Werte zur **Laufzeit** aus der Umgebung (nie ins Image gebacken, nie committet).
Vollständige Liste + Quoting-Fallen + Docker/Vercel + Entra-Redirect-URIs:
[`.env.example`](.env.example) und **[`DEPLOY.md`](DEPLOY.md)**.

Kurz: `AUTOTASK_*` (Backend) · `AUTH_MODE=mock|entra` (in Prod zwingend explizit,
fail-closed) · `RESEND_*`/`AUTOTASK_INBOUND_MAILBOX` (Kundenmail) · optional
`UPSTASH_REDIS_REST_*` (globaler Thread-Limiter). Deployment-agnostisch: **Vercel** oder
**Docker** (JWT-Session ohne DB, Route-Schutz serverseitig).

## Sicherheit & Doku

- **BFF:** Credentials nur serverseitig; Schreibpfade pro Route feld-whitelisted. ⚠️ Backend
  ist **Produktion** (kein Sandbox-Schutz). Lücken melden: [`SECURITY.md`](SECURITY.md).
- [`docs/STATE.md`](docs/STATE.md) · [`docs/DECISIONS.md`](docs/DECISIONS.md) ·
  [`DEPLOY.md`](DEPLOY.md) · [`CHANGELOG.md`](CHANGELOG.md) · Regeln: [`CLAUDE.md`](CLAUDE.md).

## Lizenz

[MIT](LICENSE) © 2026 Paul-Harald Katio.
