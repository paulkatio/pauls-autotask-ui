# STATE — Projekt-Stand & Handoff (für KI ohne Chat-Kontext)

**Lies das hier zuerst.** Diese Datei beschreibt die App selbsterklärend: was sie ist,
wie sie gebaut ist, was funktioniert, wo die Weichen stehen und was vor dem
Produktiv-Cutover noch fehlt. Tiefere Details und die Begründungen stehen in den
verlinkten Dateien.

- **Regeln (verbindlich):** `../CLAUDE.md` – Verfassung des Projekts.
- **Verifizierte API-Fakten + Entscheidungs-Historie:** [`DECISIONS.md`](DECISIONS.md) (groß, chronologisch).
- **Aufgabenliste / Status je Item:** [`BACKLOG.md`](BACKLOG.md).
- **Fachlicher Bauplan:** [`BLUEPRINT.md`](BLUEPRINT.md). **Repo-Karte:** [`ARCHITECTURE.md`](ARCHITECTURE.md).
- **Deployment + Env:** [`../DEPLOY.md`](../DEPLOY.md).

Stand: 2026-06-05. Läuft gegen die **Autotask-Sandbox**, **Entra-ID-Login live**
(`AUTH_MODE=entra`, B16a). **Chat→Kundenmail via Resend** ist verkabelt + zugestellt
verifiziert, **Inbound-Threading in der Sandbox bestätigt** (B17 – noteType 3 +
`createdByContactID`, Ticketnummer im Betreff genügt; Details in DECISIONS „B17").
Profilbild aus Microsoft Graph (B16b). Produktiv-Cutover steht aus (siehe §9).

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
- **Concurrency-Limiter** (`limiter.ts`): **max. 2 gleichzeitige Requests PRO Entität**
  (Autotask erlaubt 3/Tabelle, defensiv auf 2). Pro-Entität-Semaphore mit Warteschlange.
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

**Dashboard `/`** — 4 KPI-Kacheln (Meine offenen / Pool / Zusätzlicher Mitarbeiter / Ball
liegt bei mir; Count-Endpoint, 60 s gecacht, klickbar in Drill-down-Listen) + Balkendiagramm
„Tickets pro Mitarbeiter" (Klick filtert Teamtickets) + Tabelle „Zuletzt bearbeitet".

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
| **AUTH_MODE** | `process.env`, gelesen in `lib/auth/index.ts` | `mock` (Cutover: `entra`) |
| **Sandbox-Schreibregel** | `CLAUDE.md` §5 + Memory; **keine Runtime-Sperre, Disziplin** | Schreibtests NUR Firma „Acme GmbH Sandbox" `companyID 0`, Kontakt Paul-Harald Katio `contactID 30684646`, Titel-Präfix `ZZZ TEST` |
| **Schreib-Whitelist Ticket** | `app/api/tickets/[id]/route.ts` `EDITABLE_FIELDS` + `STRING_FIELDS` | nur gelistete Felder; Zuweisung Resource+Rolle nur zusammen |
| **Default-Queue neues Ticket** | `lib/autotask/new-ticket.ts` `NEW_TICKET_DEFAULT_QUEUE` | `29682833` (Level I-Support) |
| **Chat-noteTypes** | `lib/autotask/conversation.ts` | outbound 18 (Kundenportal), inbound 101 (E-Mail) – inbound **in Prod unverifiziert** |
| **E2E-Schreibtest** | Env `E2E_SKIP_WRITE_TESTS`, `e2e/smoke.spec.ts` | lokal an; in CI setzen → Schreibtest übersprungen |
| **Caps** | div. Entities | `COMPANIES_CAP 1000`, `OPEN_BY_COMPANY_CAP 5000`, `BALL_FETCH_CAP 500`, `SEARCH_PAGE 25`, Palette-Limit 8 |
| **Cache (`unstable_cache`)** | picklists/KPIs/Counts 60 s; `assignable-resources` 300 s | selten ändernde Daten, rate-limit-schonend |

---

## 8. Environment-Variablen (vollständig)

**Immer (Autotask-Backend, derzeit Sandbox):**
`AUTOTASK_BASE_URL` (Zone, z. B. `https://webservices18.autotask.net/ATServicesRest/V1.0`) ·
`AUTOTASK_API_USERNAME` · `AUTOTASK_API_SECRET` (Sonderzeichen → einfache Quotes) ·
`AUTOTASK_INTEGRATION_CODE`.

**Auth-Weiche:** `AUTH_MODE=mock | entra`.

**Nur bei `entra`:** `AUTH_SECRET` (`openssl rand -base64 32`) ·
`AUTH_MICROSOFT_ENTRA_ID_ID` · `AUTH_MICROSOFT_ENTRA_ID_SECRET` ·
`AUTH_MICROSOFT_ENTRA_ID_ISSUER` (`…/<TENANT_ID>/v2.0`) · `AUTH_URL` (öffentliche https-Domain) ·
`AUTH_TRUST_HOST=true` (hinter Caddy/Non-Vercel).

Details + Redirect-URI + Docker/Vercel: [`../DEPLOY.md`](../DEPLOY.md).

---

## 9. Was fehlt für den Cutover (Go-Live)

Funktional ist die App **fertig für den Sandbox-MVP**. Vor echtem Kundeneinsatz offen:

1. **Entra-ID live (B16a).** Code fertig; offen: echter OIDC-Round-Trip gegen den Tenant
   (App-Registrierung + Prod-Redirect-URI) und die **E-Mail→Resource-Zuordnung** in Prod
   (Sandbox mappt über `userName`, weil mehrere Resources die Sammel-Mail teilen). Dann
   `AUTH_MODE=entra` + Entra-Env setzen.
2. **Prod-Autotask-Creds.** `AUTOTASK_*` von Sandbox auf den Produktiv-Mandanten umstellen
   (eigener, freigegebener Schritt; **keine Runtime-Sperre** – manuelle Config). Bis dahin
   gilt die Sandbox-Schreibregel weiter.
3. **Kundenmail app-eigen via Resend (B17).** ERLEDIGT in der Sandbox: Chat sendet die
   Notiz (noteType 18) + Resend-Mail (`Reply-To` = Inbound-Mailbox), Zustellung verifiziert.
   Mail-Status geht an die UI; ohne Resend-Konfig greift der alte UDF/Workflow-Pfad.
   **Prod-Cutover offen:** alte Autotask-Workflow-Regel „Kunde benachrichtigen"
   deaktivieren (sonst Doppel-Mail), Inbound-Mailbox als Prod-Adresse gegenprüfen,
   `ENTRA_EMAIL_LOOSE_MATCH` weglassen. Rest: Anhänge (B17b). Details DECISIONS „B17".
4. **Inbound-Anzeige (B17a).** Kundenantworten kommen als **noteType 3 + `createdByContactID`**
   (NICHT 101); Chat holt + zeigt sie jetzt. **Threading in der Sandbox bestätigt** (Antwort
   landet via Ticketnummer im Betreff wieder am Ticket). Offen: einmaliger Prod-Gegencheck.
5. **Bewusst aufgeschoben:** Rollen-Gating (alle sehen alles, B12) · Anhang-Löschen (Autotask-
   API erlaubt es nicht) · optional Webhook statt Polling für den Chat.

Deployment selbst ist **vorbereitet** (deployment-agnostisch: Docker+Caddy **oder** Vercel,
JWT-Session ohne DB, Route-Schutz server-seitig) – siehe `DEPLOY.md`.

---

## 10. Arbeitsregeln für die nächste KI (Kurzfassung)

- **`CLAUDE.md` ist verbindlich.** UI nur aus shadcn + semantischen Tokens (kein freies
  `bg-blue-*`, kein arbitrary `[..]` außer in `components/ui/`), Deutsch + echte Umlaute,
  keine Emojis. Pro Slice: verifizieren → `npm run build` grün → Browser Hell/Dunkel/Mobile →
  EIN kleiner Commit → `DECISIONS.md`/`BACKLOG.md` nachziehen.
- **Nichts „fertig" behaupten ohne echten Test.** Schreibtests nur an der Sandbox-Testfirma.
- **Befunde/Entscheidungen** wandern nach `DECISIONS.md` (Gedächtnis über Sessions).
