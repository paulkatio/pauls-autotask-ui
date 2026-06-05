# ARCHITECTURE – Karte des Repos

Knappe Orientierung (für Mensch und KI): wo liegt was, wie fließen die Daten, welche
Prinzipien gelten. **Gesamt-Stand + Features + Cutover:** `docs/STATE.md`. Verbindliche
Regeln: `CLAUDE.md`. Verifizierte Fakten + Entscheidungen: `docs/DECISIONS.md`.

## Datenfluss (BFF)

```
Browser (Client Components)
   │  fetch('/api/...')                     Server Components
   ▼                                            │  direkter Aufruf
app/api/**/route.ts  ──────────►  lib/autotask/entities/<entity>.ts
(Whitelist, getSession)                         │  (dünne Wrapper)
                                                ▼
                                   lib/autotask/client.ts  (server-only)
                                   query/get/create/update + Limiter + 429-Backoff
                                                │
                                                ▼
                                   Autotask REST API  (Creds nur aus process.env)
```

- **Server Components** (Listen, Detail, Dashboard, Zeiten) rufen die Entity-Loader
  direkt auf. **Client Components** (Inline-Edits, Dialoge, Stoppuhr, Palette) gehen
  über interne `/api`-Routen. Autotask-Creds verlassen nie den Server.
- Concurrency-Limiter: max. 2 gleichzeitige Requests **pro Entität**; bei `429`
  exponentielles Backoff. Auto-Paging über `pageDetails.nextPageUrl`.
- Paging-Varianten: `queryPage` (server-seitiger Cursor, Next/Prev), `queryPageToken`
  (OPAKES Token = Pfad ohne Basis-URL → Cursor gelangt nie zum Browser; für `/search`),
  `count` (`{entity}/query/count`, Anzahl ohne Datensätze).

## Verzeichnisse

- **`app/`** – Next.js App Router.
  - **`(app)/`** – geschützte App-Shell (`layout.tsx`: Sidebar + Header +
    Command-Palette + Toaster, `requireSession()`). Seiten: `page.tsx` (Dashboard),
    `tickets/{my,team,secondary,ball}`, `tickets/[id]` (Detail), `companies`,
    `companies/[id]` (Kundenakte), `contacts`, `contacts/[id]`, `search`, `zeiten`,
    `admin`. **Jede Route hat ein layout-treues `loading.tsx`** (Skeletons, s. u.).
  - **`api/`** – BFF-Routen. Schreiben: `tickets` (POST), `tickets/[id]` (PATCH),
    `tickets/[id]/{chat,note,time,attachments}` (POST). Lesen: `tickets/[id]` (GET),
    `tickets/search`, `tickets/[id]/attachments/[attachmentId]` (Download), `search`
    (paginierte 4-Spalten-Suche), `companies`, `contacts`, `contacts/search`,
    `resources`, `resources/[id]/roles`, `picklists`, `auth/[...nextauth]`.
  - `login/`, `no-access/`, `layout.tsx` (Root), `globals.css` (OKLCH-Theme-Tokens).
- **`components/`**
  - App-Rahmen: `app-sidebar` (Autotask-Logo via statischem Import), `nav-*`,
    `header-*`, `page-header`, `theme-*`, `mock-user-switcher`, `command-palette`
    (Spotlight, 4 Spalten).
  - Feature-Slices: `tickets/*` (Detail, Liste, **bulk-bar**, Meta-Edit, Chat, Zeit-/
    Notiz-/Neues-Ticket-Formulare, Zeiterfassung, Attachment-Upload), `companies/*`
    (Tabelle, Tabs, Kundenakte-Panels), `contacts/*`, `search/*` (search-box,
    result-column, **search-columns** mit „Mehr laden"), `dashboard/*`, `time/*`.
  - Querschnitt: `skeletons` (layout-treue Loading-Bausteine), `truncated-text`
    (Ellipsis + Hover-Tooltip), `searchable-table` (generische durchsuchbare Tabelle),
    `url-tabs`.
  - **`ui/`** – vendored shadcn/ui-Primitiven (nur hier sind arbitrary Tailwind-
    Values erlaubt; Feature-Code nutzt Tokens + Standard-Utilities).
- **`hooks/`** – `use-column-order` (Spalten-Drag&Drop, localStorage je Tabelle),
  `use-mobile`.
- **`lib/`**
  - **`auth/`** – `session.ts` (Typ `SessionUser`, einzige User-Repräsentation),
    `provider.ts` (Interface), `mock-provider.ts`, `entra-provider.ts`, `authjs.ts`,
    `index.ts` (wählt Provider via `AUTH_MODE`), `actions.ts`.
  - **`autotask/`** – `client.ts` (generischer Kern), `types.ts` (V5-Felder),
    `limiter.ts`, `backoff.ts`, `mappers.ts` (ID→Label + Badge-Varianten),
    `conversation.ts` (Chat-noteTypes/UDF), `new-ticket.ts` (Default-Queue),
    `attachments-shared.ts` (Größenlimit), `company-types.ts`, **`entities/<entity>.ts`**
    (dünne Wrapper: tickets, ticket-detail, ticket-list, ticket-notes, ticket-chat,
    time-entries, my-time, companies, company-list, contacts, contact-list, resources,
    config-items, contracts, picklists, dashboard, search, attachments).
  - `format.ts`, `utils.ts`.
- **`e2e/`** – Playwright-Smoke-Suite (`auth.setup.ts`, `smoke.spec.ts`).
- **`scripts/`** – `verify-api.mjs` (Wegwerf-Verifikation gegen die Sandbox,
  `node --env-file=.env.local …`).
- **`docs/`** – **STATE** (Stand/Handoff), BLUEPRINT, DECISIONS, BACKLOG, PHASE-0,
  ARCHITECTURE, README.

## Prinzipien (Erweiterbarkeit + günstige Discovery)

1. **Generischer Client-Kern + dünne Entity-Wrapper.** Neue Autotask-Entität =
   eine neue kleine Datei unter `entities/`, kein Eingriff in den Kern.
2. **Feld-/Picklist-Registry** aus `entityInformation/fields` (gecacht) – UI-Labels
   werden nicht über den Code verstreut hartkodiert (`picklists.ts`, `mappers.ts`).
3. **Feature-Slices** als geschlossene Ordner.
4. **Schreibpfade hinter schmaler, geprüfter Schicht** – jede `/api`-Route
   whitelistet die erlaubten Felder; Schreiben nur nach Phase-0-Verifikation.
5. **Auth gekapselt** – Server liest nur `SessionUser`; Wechsel Mock↔Entra = eine
   Env-Variable.

## Konventionen

- UI ausschließlich aus shadcn-Komponenten + semantische Tokens; Light + Dark über
  Tokens (keine manuellen `dark:`-Farb-Overrides). Deutsch, echte Umlaute, keine
  Emojis (nur lucide-Icons).
- Schreib-Disziplin: Lade-/Fehler-/Erfolgs-Zustand, `router.refresh()` nach Erfolg,
  Test-Writes nur an der Sandbox-Testfirma (siehe `CLAUDE.md` §5).
