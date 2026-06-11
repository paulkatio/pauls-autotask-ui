# STATE — Projekt-Stand & Handoff (für KI ohne Chat-Kontext)

**Lies das hier zuerst.** Diese Datei beschreibt die App selbsterklärend: was sie ist,
wie sie gebaut ist, was funktioniert, wo die Weichen stehen und was vor dem
Produktiv-Cutover noch fehlt. Tiefere Details und die Begründungen stehen in den
verlinkten Dateien.

- **Regeln (verbindlich):** `../CLAUDE.md` – Verfassung des Projekts.
- **Verifizierte API-Fakten + Entscheidungs-Historie:** [`DECISIONS.md`](DECISIONS.md) (groß, chronologisch).
- **Deployment + Env:** [`../DEPLOY.md`](../DEPLOY.md).

Stand: 2026-06-11. **Produktiv-Cutover erfolgt:** läuft gegen den **Autotask-Produktiv-
Mandanten** (Zone DE1, `webservices18`, eigener API-User „AutoTask UI" → Thread-Budget von
n8n entkoppelt). **Entra-ID-Login live** (`AUTH_MODE=entra`, B16a). Profilbild aus Microsoft
Graph (B16b).

**2026-06-11 (Projekte, zusätzliche Mitarbeiter, KPI-Redesign, globaler Thread-Limiter):**
**Projekte** als neuer Menüpunkt + Seite `/projekte` (Meine/Alle-Umschalter + Suche; „Meine" =
selbst **geleitet** ODER eigene **Projektaufgabe**; `lib/autotask/entities/projects.ts`);
Dashboard-Kachel „Zusätzlicher Mitarbeiter" → **„Meine Projekte"**. **Zusätzliche Mitarbeiter**
im Ticketdetail (`TicketSecondaryResources`, anzeigen/hinzufügen/entfernen; an 56313 live
verifiziert). **KPI-Kacheln neu** (Container-Queries → auf jeder Größe gleich hoch). **Ticketlisten:**
einspaltige Karten, volle Tabelle ab `lg`, Filter als gleichmäßiges Grid. **„Meine offenen
Tickets"** inkl. zusätzlicher Mitarbeiter; eigener Bereich auf `/tickets/my`; `/tickets/secondary`
entfernt. **Thread-Threshold behoben:** Dashboard-Fan-out (N Ticket-Counts → 1 Abfrage),
Tickets-Concurrency 1/Instanz, längere Caches **und ein globaler, instanzenübergreifender
Limiter über Upstash Redis** (`lib/autotask/global-limiter.ts`, aktiv via `UPSTASH_REDIS_REST_*`,
sonst In-Process-Fallback). Details: DECISIONS „[2026-06-11]".

**2026-06-10 (Mobile/PWA-Überarbeitung, branch `feat/mobile-pwa-native`, noch nicht
gemerged):** Die mobile Ansicht/PWA funktioniert jetzt wie eine **echte App**, Desktop
unverändert. **In-App-Navigation** (`hooks/use-record-nav.ts` + `lib/standalone.ts`):
Ticket/Firma öffnet mobil/PWA IN der App (kein neuer Browser-Tab); Desktop behält die
Pop-out-Fenster. **Bottom-Navigation** (`components/mobile-bottom-nav.tsx`: Übersicht ·
Meine · Team · Suche · Mehr); mobiler Header mit Logo links, Zurück auf Detailseiten,
Hamburger rechts, **Sidebar von rechts**. **Safe-Areas** (`viewport-fit=cover`,
`env(...)`-Insets, `dvh`, `interactiveWidget=resizes-content`). **Bottom-Sheets** für
Formulare (`components/ui/responsive-dialog.tsx`, base-ui `Sheet`, kein vaul);
Chat-Composer tastatursicher. **Mobile Filter als Chips**, Touch-Ziele ≥40 px.
**Ticketdetail** mit mobilem „Ticket Summary"-Case-Header. **Meine/Teamtickets ohne
Paginierung** (`getTicketsAll`, Cap 500) – alle offenen in einer Liste. **Dashboard-Sektion
„Offene Tickets"** (ersetzt „Letzte Aktivität", `RecentlyEdited` entfernt) im Teamlisten-Look
+ Schnellfilter + „Alle offenen anzeigen". Label **„Dashboard" → „Übersicht"**. Details:
DECISIONS „[2026-06-10]".

**2026-06-09 (UI-/Workflow-Ausbau, branch `fix/responsive-tables-ticket-popup`, noch nicht
gemerged):** Chat ist jetzt ein **reines Kundenfenster** (Intern/Kunde-Switch raus, jede
Nachricht geht an den Kunden, Bestätigungsdialog bleibt; interne Notizen via „Neue Notiz").
**Inbound prod-verifiziert** (Ticket 56313): Kundenantworten zuverlässig über Body-Marker
„Durch eingehende E-Mail-Verarbeitung erstellt" erkannt (createdByContactID kann NULL sein).
**Kunden-Mail** im Autotask-Vorlagen-Look (hell, Logo, Footer; Betreff `[<Nr>] Neue Nachricht
zu Ihrem Ticket`). **Drag&Drop-Anhänge** (ausgehend) → Ticket-Attachment + Mail-Anhang.
**Status-Workflow:** Schließen/Öffnen verlangt Pflichtnotiz; Zeit-Dialog mit Status +
Abschlussbenachrichtigung. **Responsive Tabellen** (Card↔Table ab xl/2xl, Skeletons synchron),
**Aktivität-Feed** einklappbar (Kundenantworten offen), **Status-Farbpunkte**. Details:
DECISIONS „[2026-06-09]".

**Sicherheits-Härtung 2026-06-08:** Auth fail-closed (`AUTH_MODE` in Prod zwingend explizit),
Chat-Mail opt-in statt default-an, Merge-Cap (max 10), `ENTRA_EMAIL_LOOSE_MATCH` in Prod
entfernt, Branding dynamisch aus Autotask (`companyID 0`). Kein globaler READ_ONLY-Riegel
(bewusst) → Schreibpfade scharf gegen Prod. Details: DECISIONS „Produktiv-Cutover + Sicherheits-Härtung".

---

## 1. Was die App ist

Interne Web-App als fokussierte, modernere Alternative zur Autotask-Oberfläche – nur was
Techniker/Service-Desk täglich brauchen. **Backend-for-Frontend (BFF):** der Browser
spricht ausschließlich mit internen `/api`-Routen dieser App; **Autotask-Zugangsdaten
bleiben immer serverseitig**.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 ·
**shadcn/ui** (und sonst keine UI-Lib) · Charts über shadcn-`Chart` (Recharts) ·
`next-themes` (Light/Dark/System) · Icons `lucide-react` · Auth über eigene
Abstraktion (Mock **oder** Microsoft Entra ID via Auth.js v5) · Tests: Playwright.

---

## 2. Schnellstart

```bash
npm install
# .env.example -> .env.local kopieren und füllen (siehe §8). Secret in EINFACHE
# Anführungszeichen ('...'), sonst bricht der Login mit 401 (Sonderzeichen # $ …).
npm run dev            # http://localhost:3000   (Mock-Login: per Klick als Sandbox-User)
npm run build          # typisiert + kompiliert (muss grün sein)
npm run test:e2e       # Playwright-Smoke (10 Tests; einmalig: npx playwright install chromium)
```

Mock-Modus: Login per Klick, im Header ein User-Umschalter (als anderer Kollege agieren →
„Meine Tickets" je Resource). Kein Rechte-Gating.

---

## 3. Architektur & Datenfluss — die Autotask-REST-Anbindung („RPD")

> Hinweis: „RPD" interpretiert als die **Request-Pipeline / REST-Anbindung an Autotask**
> (der Datenfluss BFF ↔ Autotask). Genau das beschreibt dieser Abschnitt.

```
Browser (Client Components)
   │  fetch('/api/...')                         Server Components
   ▼                                                │  direkter Aufruf
app/api/**/route.ts  ───────────────►  lib/autotask/entities/<entity>.ts
(getSession + Feld-Whitelist)                       │  (dünne Wrapper)
                                                    ▼
                                       lib/autotask/client.ts  (server-only)
                                       query/get/create/update + Limiter + 429-Backoff
                                                    │  Creds nur aus process.env
                                                    ▼
                                       Autotask REST API
```

- **Server Components** (Dashboard, Listen, Detail, Zeiten, Suche) rufen die Entity-Loader
  **direkt** auf. **Client Components** (Inline-Edits, Dialoge, Stoppuhr, Palette, Bulk,
  „Mehr laden") gehen über interne `/api`-Routen. Autotask-Creds verlassen nie den Server.
- **`lib/autotask/client.ts`** (das Herz): baut die Auth-Header aus `process.env`
  (`ApiIntegrationCode`/`UserName`/`Secret` + Base-URL), `fetch` mit `cache:"no-store"`.
  Öffentliche Methoden des `autotask`-Objekts:
  - `query<T>(entity, body, opts?)` – Auto-Paging über `pageDetails.nextPageUrl`
    (Filter wird je Seite erneut gesendet; Hard-Cap `MAX_PAGES=50`, Soft-Cap `maxItems`).
  - `queryPage<T>(entity, body, cursorUrl?)` – EINE Seite, server-seitiger Cursor (Next/Prev).
  - `queryPageToken<T>(entity, body, token?)` – EINE Seite mit **opakem Token**: der Token
    ist nur der Pfad NACH der Basis-URL; die Basis-URL bleibt server-seitig und gelangt nie
    zum Browser (SSRF-Prüfung: Token muss zu `${base}/${entity}/query/` passen). Für die
    paginierte `/search`-Seite.
  - `count(entity, filter)` – `POST {entity}/query/count` → Anzahl ohne Datensätze.
  - `get/create/update`, `fieldInfo`.
- **Concurrency-Limiter** (`limiter.ts`): pro Entität max. 2 gleichzeitige Requests,
  **`Tickets` auf 1** (Per-Key-Limit). Dieser Limiter ist **pro Prozess** → auf Vercel
  summieren sich Instanzen über das 3er-Limit. Darum zusätzlich ein **globaler, verteilter
  Semaphore** über Upstash Redis (`global-limiter.ts`, Redis-ZSET + Lua, TTL-Sicherung): hält
  pro Objekt-Endpoint **global ≤ 2** über ALLE Instanzen (Autotask-Limit = 3/Objekt je
  Integration). Aktiv via `UPSTASH_REDIS_REST_URL/_TOKEN`; ohne diese exakt der In-Process-
  Limiter (Fallback, kein Bruch). Live an der Upstash-DB verifiziert (6 parallele Tasks → nie
  > 2 gleichzeitig).
- **429-Backoff** (`backoff.ts`): exponentiell `500ms · 2^n`, 4 Versuche (Autotask sendet
  keine Rate-Limit-Header → blind, konservativ).
- **Entity-Wrapper** (`lib/autotask/entities/*`): dünne, getypte Loader je Entität
  (tickets, ticket-detail, ticket-list, ticket-notes/-chat, time-entries, my-time,
  companies, company-list, contacts, contact-list, resources, config-items, contracts,
  picklists, dashboard, search, attachments). **Neue Autotask-Entität = eine neue kleine
  Datei**, kein Eingriff in den Kern.
- **Picklists/Labels** kommen aus `entityInformation/fields` (gecacht), nicht hartkodiert
  (`picklists.ts` + `mappers.ts` ID→Label, inkl. Badge-Varianten).

---

## 4. Auth (die zentrale Weiche `AUTH_MODE`)

`lib/auth/index.ts` wählt anhand `process.env.AUTH_MODE` den Provider:
`"entra"` → `entra-provider`, sonst (Default) → `mock-provider`. **Server-Code liest
ausschließlich `SessionUser`** – niemand greift direkt auf „den Login" zu. Umschalten
Mock↔Entra = **nur diese eine Env-Variable**.

```ts
type Role = "agent" | "teamleiter" | "admin";
interface SessionUser {
  id: string;                 // Mock: userName · Entra: oid
  email: string; displayName: string;
  roles: Role[];              // Rollen werden aktuell NICHT ausgewertet (kein Gating, B12)
  autotaskResourceId: number; // Mapping auf Autotask-Resource (nötig für „Meine Tickets")
}
```

- `getSession()` → `SessionUser | null`. `requireSession()` (in `app/(app)/layout.tsx`)
  erzwingt Login; Entra-User ohne Autotask-Resource → `/no-access`, sonst `/login`.
- **Mock** (`mock-provider.ts` + `mock-users.ts`): Cookie `mock_user` = userName → statischer
  Sandbox-User. Drei Mock-User (Sandbox-Resource-IDs): Demo Agent (29682903),
  **Demo Teamlead** (29682886, agent+teamleiter), Demo Admin (4).
- **Entra** (`entra-provider.ts` + `authjs.ts`, Auth.js v5, OIDC, **JWT-Session**, keine DB):
  beim Sign-in wird die E-Mail → Autotask-Resource aufgelöst (`resources.byEmail`) und in
  den JWT gecacht; ohne Treffer `atError="NO_RESOURCE"`. Rollen aktuell fix `["agent"]`.

---

## 5. Feature-Inventar (was ist da + wie)

**Dashboard `/`** — 4 KPI-Kacheln (Meine Tickets [inkl. zusätzlicher Mitarbeiter] / Nicht
zugewiesen / **Meine Projekte** / Ball liegt bei mir; Count-Endpoint, 60 s gecacht, klickbar in Drill-down-Listen) + Balkendiagramm
„Tickets pro Mitarbeiter" (Klick filtert Teamtickets) + Sektion **„Letzte Aktivität"**
(`recently-edited.tsx`): zuletzt aktive Tickets systemweit, dezente Stat-Zeile „X heute aktiv
· Y in 7 Tagen" + 10 neueste als `TicketCard` (variant `activity`).

**Gemeinsames mobiles Karten-System** — `components/tickets/ticket-card.tsx`: EINE Hierarchie
für alle mobilen Ticketlisten (Titel → „Firma · Nummer" → Status/Priorität/Queue/Bearbeiter →
Kontextdatum). Variante `worklist` (→ „Fällig …") und `activity` (→ „Aktualisiert …", bei
Status Neu „Erstellt …"). `tickets-list.tsx` und `recently-edited.tsx` nutzen sie; Firmen/
Kontakte (`searchable-table.tsx`) teilen Radius/Border/Focus/Hover/Abstände – keine Insel-Designs.

**Ticketlisten** — gemeinsame `components/tickets/tickets-list.tsx`:
- `/tickets/my` (server-gefiltert auf `assignedResourceID` der Session), `/tickets/team`
  (alle, Pool-Blick „nicht zugewiesen", Chart-Klick-Filter), `/tickets/secondary`
  (Nebentickets), `/tickets/ball` (letzte Aktivität vom Kunden).
- Filter (Status/Priorität/Queue/Zuweisung) server-seitig; **Sortierung clientseitig**
  (Autotask sortiert nicht, B13). Volltextsuche (`?q=` Nummer/Titel) debounced.
- **Bulk-Aktionen** (`bulk-bar.tsx`): Mehrfachauswahl (Checkbox), Status/Priorität/Queue
  ändern, Zuweisen + „Mir zuweisen" (Resource+Rolle gekoppelt). KEIN neuer Schreibpfad – pro
  Ticket das bestehende `PATCH /api/tickets/[id]`, Limiter max 3 parallel, Fortschritt,
  Teilfehler-Zusammenfassung, **Undo** der letzten Aktion (snapshot der Altwerte). Die
  Bulk-Leiste **ersetzt die Filterzeile an gleicher Stelle** (Grid-Stack, konstante Höhe →
  kein Layout-Sprung).

**Ticketdetail `/tickets/[id]`** (`ticket-detail.tsx` + `meta-edit.tsx`): Inline-Edit
(Status/Priorität/Queue/Kategorie, Zuweisung Resource+Rolle, Firma-Wechsel mit Nullen der
firmengebundenen Refs, Kontakt/Gerät/Vertrag-Combobox, Beschreibung). **Chat-Sidebar**
(`ticket-chat.tsx`, kundensichtbare Notizen, 45 s Polling, Senden = TicketNote + Notify-
Schalter). **Zeit erfassen** (`time-entry-dialog.tsx` + Stoppuhr) und **interne Notiz**
(`note-form.tsx`, immer noteType 2, nie kundensichtbar). **Anhänge** lesen/herunterladen/
hochladen (max **10 MB**; Löschen per API nicht möglich → 405).

**Firmen** — `/companies` (`companies-table.tsx`: aktive Firmen, Kundenart-Filter Default
„Kunde", Spalte „offene Tickets" aus EINEM gebündelten Abruf, Client-Sort). `/companies/[id]`
**Kundenakte** (`company-tabs.tsx` + `kundenakte-panels.tsx`): Stammdaten-Zeile + 5 KPI-
Kacheln (klickbar in Tabs) + Tabs Offen/Abgeschlossen/Kontakte/Geräte/Verträge + „Neues
Ticket für diese Firma".

**Kontakte** — `/contacts` (`contacts-table.tsx`: server-`contains`-Suche, Firma-Filter-
Combobox) + `/contacts/[id]` (Firma-Link + Tickets-Tabs).

**Globale Suche** — **Spotlight-Palette** (`command-palette.tsx`, Cmd/Strg+K): große Leiste,
**4 Spalten parallel** (Firma · Kontakte · Ticket-Name · Ticket-Nummer), je 8 Schnelltreffer.
**`/search`** (`search-columns.tsx`): dieselben 4 Spalten als **volle Trefferlisten mit „Mehr
laden" pro Spalte** (Cursor-Token an `/api/search`) + **Gesamtzahl** je Spalte. Responsiv: 4
Spalten ≥1280px, 2 ab 640px, 1 mobil (gestapelt).

**Tabellen-Veredelung (überall):** Spaltenbreiten gedeckelt (`max-w-*`), zu lange Werte
abgeschnitten + **voller Text bei Hover** (`truncated-text.tsx`, Tooltip nur wenn wirklich
abgeschnitten). **Spalten per Drag & Drop umsortierbar** (`hooks/use-column-order.ts`,
native DnD, localStorage je Tabelle, „Spalten zurücksetzen"). „Meine Zeiten" `/zeiten`
(Heute/Woche-Umschalter, Summen) und die Kundenakte-Tabs nutzen `searchable-table.tsx`.

**Skeletons (`components/skeletons.tsx` + jede `loading.tsx`):** spiegeln das **echte
Raster** (gleiche Table-/Card-/Grid-Bausteine), keine generischen Balken.

**Theming/Branding:** Light+Dark über semantische OKLCH-Tokens (`globals.css`), Indigo-
Akzent. **Badge-Ampel**: Priorität Niedrig=grün, Mittel=amber, Hoch/Kritisch=rot; Status
sinnvoll (rot=Problem, amber=wartet, indigo=aktiv, grün=abgeschlossen) – über neue Tokens
`--success`/`--warning`. **Autotask-Logo** oben links (statischer Import → inhalts-gehashte
URL, Cache-bust bei Tausch).

---

## 6. Datei-Karte (wo liegt was)

- **`app/(app)/`** — geschützte Shell (`layout.tsx`: `requireSession`, Sidebar+Header+
  Command-Palette+Toaster). Seiten: `page.tsx` (Dashboard), `tickets/{my,team,secondary,ball,[id]}`,
  `companies`, `companies/[id]`, `contacts`, `contacts/[id]`, `search`, `zeiten`, `admin`.
  Jede Route hat ein passendes `loading.tsx`.
- **`app/api/`** — BFF-Routen. **Schreiben:** `tickets` (POST create), `tickets/[id]` (PATCH),
  `tickets/[id]/{chat,note,time,attachments}` (POST). **Lesen:** `tickets/[id]` (GET),
  `tickets/search`, `search`, `companies`, `contacts`, `contacts/search`, `resources`,
  `resources/[id]/roles`, `picklists`, `tickets/[id]/attachments/[attachmentId]` (Download),
  `auth/[...nextauth]`.
- **`components/`** — `ui/` (vendored shadcn; NUR hier sind arbitrary Tailwind-Values erlaubt),
  Feature-Slices (`tickets/`, `companies/`, `contacts/`, `search/`, `time/`, `dashboard/`),
  Rahmen (`app-sidebar`, `nav-*`, `header-*`, `command-palette`, `theme-*`,
  `mock-user-switcher`), Querschnitt (`skeletons`, `truncated-text`, `searchable-table`,
  `page-header`, `url-tabs`).
- **`lib/`** — `auth/*` (Session/Provider/Mock/Entra/Index), `autotask/*` (client, limiter,
  backoff, types, mappers, conversation, new-ticket, attachments-shared, company-types,
  `entities/*`), `format.ts`, `utils.ts`.
- **`hooks/`** — `use-column-order.ts`, `use-mobile.ts`.
- **`e2e/`** — Playwright-Smoke (`auth.setup.ts`, `smoke.spec.ts`). **`scripts/`** — Wegwerf-
  API-Verifikation gegen die Sandbox.

---

## 7. Weichen (alle Schalter — wo/wie gestellt)

| Weiche | Wo | Default / Wert |
|---|---|---|
| **AUTH_MODE** | `process.env`, gelesen in `lib/auth/index.ts` | Prod: `entra`. **Fail-closed:** in `NODE_ENV=production` muss explizit `entra`/`mock` gesetzt sein, sonst Abbruch (kein stiller Mock). Ausnahme `next build`. |
| **PROD-Backend (kein Sandbox-Schutz)** | `AUTOTASK_*` zeigt auf Produktion | **Keine Runtime-Sperre.** Schreibpfade wirken sofort+unumkehrbar gegen echte Kunden. Sandbox-Regel (companyID 0 / contactID 30684646 / `ZZZ TEST`) greift NICHT mehr. |
| **Branding-Name** | `lib/branding-server.ts` `getOrgName()` | Env `NEXT_PUBLIC_ORG_NAME` (Override) → sonst Autotask `companyID 0` (24 h gecacht) → Fallback „Acme GmbH" |
| **Schreib-Whitelist Ticket** | `app/api/tickets/[id]/route.ts` `EDITABLE_FIELDS` + `STRING_FIELDS` | nur gelistete Felder; Zuweisung Resource+Rolle nur zusammen |
| **Default-Queue neues Ticket** | `lib/autotask/new-ticket.ts` `NEW_TICKET_DEFAULT_QUEUE` | `29682833` (Level I-Support) |
| **Chat-noteTypes / Inbound** | `lib/autotask/conversation.ts` | outbound 18; Inbound = `createdByContactID` gesetzt **ODER** Body-Marker „Durch eingehende E-Mail-Verarbeitung erstellt" (echte Antworten sind noteType 3, createdByContactID ggf. NULL). **Prod-verifiziert (56313, 2026-06-09).** |
| **Chat-Mailversand** | `ticket-chat.tsx` + `chat/route.ts` | **Reines Kundenfenster:** jede Chat-Nachricht geht an den Kunden (`notify:true`), Bestätigungsdialog vor Versand. Interne Notizen separat via „Neue Notiz" (noteType 2). |
| **Merge-Cap** | `app/api/tickets/merge/route.ts` | max **10** Quelltickets pro Request |
| **E2E-Schreibtest** | Env `E2E_SKIP_WRITE_TESTS`, `e2e/smoke.spec.ts` | lokal an; in CI setzen → Schreibtest übersprungen |
| **Caps** | div. Entities | `COMPANIES_CAP 1000`, `OPEN_BY_COMPANY_CAP 5000`, `BALL_FETCH_CAP 500`, `SEARCH_PAGE 25`, Palette-Limit 8 |
| **Cache (`unstable_cache`)** | picklists 60 s; dashboard-kpis 180 s, tickets-per-resource 300 s, sidebar-counts 120 s; `assignable-resources` 300 s | rate-limit-schonend (Thread-Threshold) |
| **Globaler Thread-Limiter** | `lib/autotask/global-limiter.ts` (Upstash Redis), Env `UPSTASH_REDIS_REST_URL/_TOKEN` | gesetzt → global ≤ 2/Objekt über alle Instanzen; leer → In-Process-Limiter |

---

## 8. Environment-Variablen (vollständig)

**Immer (Autotask-Backend, Produktion):**
`AUTOTASK_BASE_URL` (Zone, **MUSS auf `/V1.0` enden**, z. B. `https://webservices18.autotask.net/ATServicesRest/V1.0`) ·
`AUTOTASK_API_USERNAME` · `AUTOTASK_API_SECRET` (`$`/`#` → in `.env.local` einfache Quotes; bei
`docker --env-file` KEINE Quotes) · `AUTOTASK_INTEGRATION_CODE`.

**Auth-Weiche:** `AUTH_MODE=mock | entra` (in Prod zwingend explizit, fail-closed).

**Optional:** `NEXT_PUBLIC_ORG_NAME` (Branding-Override; sonst Auto aus `companyID 0`).

**Nur bei `entra`:** `AUTH_SECRET` (`openssl rand -base64 32`) · `ENTRA_CLIENT_ID` ·
`ENTRA_CLIENT_SECRET` · `ENTRA_TENANT_ID` (tenant-spezifischer Issuer `…/<tenant>/v2.0`,
explizit in `lib/auth/authjs.ts` verdrahtet — NICHT die Auth.js-Default-Namen) ·
`AUTH_URL` (öffentliche https-Domain) · `AUTH_TRUST_HOST=true` (hinter Caddy/Non-Vercel).
`ENTRA_EMAIL_LOOSE_MATCH` war ein Sandbox-Workaround → **in Prod weggelassen** (exakte Mails).

**Für Chat-Kundenmail:** `RESEND_API_KEY` · `RESEND_FROM` · `AUTOTASK_INBOUND_MAILBOX`.

**Optional (globaler Thread-Limiter):** `UPSTASH_REDIS_REST_URL` · `UPSTASH_REDIS_REST_TOKEN`
(Upstash Redis). Gesetzt → ein instanzenübergreifender Semaphore hält das Autotask-3-Threads-
Limit global ein; leer → In-Process-Limiter (Fallback, kein Bruch).

Details + Redirect-URI + Docker/Vercel + Secret-Quoting: [`../DEPLOY.md`](../DEPLOY.md).

---

## 9. Cutover-Stand (Go-Live)

**Prod-Cutover erfolgt 2026-06-08:** `AUTOTASK_*` → Produktiv-Mandant (Zone DE1,
`webservices18`, eigener API-User), `AUTH_MODE=entra` live, `ENTRA_EMAIL_LOOSE_MATCH`
entfernt, Sicherheits-Härtung umgesetzt (Auth fail-closed, Chat-Mail opt-in, Merge-Cap,
Branding aus `companyID 0`). `tsc` + `next build` + Docker-Build grün.

**Noch offen / im Auge behalten:**
1. **Doppel-Mail-Check.** Falls in Autotask noch die Workflow-Regel „Kunde benachrichtigen"
   aktiv ist: deaktivieren, sonst mailt Resend **und** der Autotask-Workflow. Inbound-Mailbox
   als Prod-Adresse gegenprüfen.
2. **Inbound-Anzeige in Prod (B17a) — ERLEDIGT (2026-06-09, Ticket 56313).** Kundenantwort kam
   als noteType 3 mit **`createdByContactID = NULL`** (auf Resource gemappt) → Erkennung jetzt
   zusätzlich über Body-Marker „Durch eingehende E-Mail-Verarbeitung erstellt". Threading via
   Ticketnummer im Betreff bestätigt.
3. **Anhänge (B17b)** · **Doppel-Mail-Workflow** wie oben.
4. **Bewusst aufgeschoben:** kein globaler READ_ONLY-Riegel (abgelehnt) · Rollen-Gating
   (alle sehen alles, B12) · Anhang-Löschen (API erlaubt es nicht) · Webhook statt Chat-Polling ·
   10k/h-Frühwarnung + Backoff-Jitter. (Der früher hier gelistete instanzenübergreifende
   Redis-Limiter ist jetzt **umgesetzt**: Upstash-Semaphore in `lib/autotask/global-limiter.ts`.)

Deployment selbst ist **vorbereitet** (deployment-agnostisch: Docker+Caddy **oder** Vercel,
JWT-Session ohne DB, Route-Schutz server-seitig) – siehe `DEPLOY.md`.

---

## 10. Arbeitsregeln für die nächste KI (Kurzfassung)

- **`CLAUDE.md` ist verbindlich.** UI nur aus shadcn + semantischen Tokens (kein freies
  `bg-blue-*`, kein arbitrary `[..]` außer in `components/ui/`), Deutsch + echte Umlaute,
  keine Emojis. Pro Slice: verifizieren → `npm run build` grün → Browser Hell/Dunkel/Mobile →
  EIN kleiner Commit → `DECISIONS.md` nachziehen.
- **Nichts „fertig" behaupten ohne echten Test.** ⚠️ Backend ist **PRODUKTION** – Schreibtests
  treffen echte Kunden (kein Sandbox-Schutz mehr). Read-only-Smoke: `verify-api.mjs ping`.
  Schreiben nur bewusst, an einem dir gehörenden Ticket; Chat-Mail nur mit aktivem Schalter.
- **Befunde/Entscheidungen** wandern nach `DECISIONS.md` (Gedächtnis über Sessions).
