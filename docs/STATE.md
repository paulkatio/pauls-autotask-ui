# STATE — Projekt-Stand & Handoff (für KI ohne Chat-Kontext)

**Lies das hier zuerst.** Diese Datei beschreibt die App selbsterklärend: was sie ist,
wie sie gebaut ist, was funktioniert, wo die Weichen stehen und was noch offen ist.
Begründungen + verifizierte API-Fakten stehen in den verlinkten Dateien.

- **Regeln (verbindlich):** [`../CLAUDE.md`](../CLAUDE.md) — Verfassung des Projekts.
- **Verifizierte API-Fakten + Entscheidungs-Historie:** [`DECISIONS.md`](DECISIONS.md) (groß, chronologisch; oben ein TL;DR-Index).
- **Sicherheits-Audit:** [`SECURITY-AUDIT.md`](SECURITY-AUDIT.md).
- **Deployment + Env:** [`../DEPLOY.md`](../DEPLOY.md). **Versions-Historie:** [`../CHANGELOG.md`](../CHANGELOG.md).

**Stand: 2026-06-18.** Die App läuft **gegen Produktion** (Autotask-Produktiv-Mandant,
Zone DE1, `webservices18`, eigener API-User → Thread-Budget von n8n entkoppelt) mit
**Entra-ID-Login** (`AUTH_MODE=entra`, Profilbild aus MS Graph). **Kein Sandbox-Schutz mehr:**
Schreibpfade wirken sofort und unumkehrbar gegen echte Kunden (siehe §7/§10).

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
npm run dev            # http://localhost:3000   (Entra-Login; Mock nur mit AUTH_MODE=mock)
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run build          # muss grün sein
npm run test:e2e       # Playwright-Smoke (einmalig: npx playwright install chromium)
```

**Mock-Modus** (`AUTH_MODE=mock npm run dev`): Login per Klick, im Header ein User-Umschalter
(als anderer Kollege agieren → „Meine Tickets" je Resource). Kein Rechte-Gating. Nur **1
Next-Dev pro Verzeichnis** (Lock) — für Browser-Verifikation den :3000-Dev stoppen und Mock
auf Alt-Port starten (`AUTH_MODE=mock npm run dev -- -p 3050`).

---

## 3. Architektur & Datenfluss (REST-Anbindung an Autotask)

```
Browser (Client Components)
   │  fetch('/api/...')                         Server Components
   ▼                                                │  direkter Aufruf
app/api/**/route.ts  ───────────────►  lib/autotask/entities/<entity>.ts
(guardApi: CSRF+Session+Rate-Limit,                 │  (dünne Wrapper)
 + Feld-Whitelist beim Schreiben)                   ▼
                                       lib/autotask/client.ts  (server-only)
                                       query/get/create/update + Limiter + 429-Backoff
                                                    │  Creds nur aus process.env
                                                    ▼
                                       Autotask REST API
```

- **Server Components** (Dashboard, Listen, Detail, Zeiten, Suche, Vertrieb) rufen die
  Entity-Loader **direkt** auf. **Client Components** (Inline-Edits, Dialoge, Stoppuhr,
  Palette, Bulk, „Mehr laden") gehen über interne `/api`-Routen. Creds verlassen nie den Server.
- **`lib/autotask/client.ts`** (Herz): baut Auth-Header aus `process.env`
  (`ApiIntegrationCode`/`UserName`/`Secret` + Base-URL), `fetch` mit `cache:"no-store"`.
  Methoden: `query` (Auto-Paging über `pageDetails.nextPageUrl`, Hard-Cap `MAX_PAGES=50`,
  Soft-Cap `maxItems`), `queryPage`/`queryPageToken` (eine Seite, opaker Token → Basis-URL
  bleibt server-seitig, SSRF-geprüft), `count`, `get/create/update`, `fieldInfo`.
- **Concurrency-Limiter** (`limiter.ts`): pro Entität max. 2, **`Tickets` auf 1**; **pro Prozess**.
  Darum zusätzlich ein **globaler, verteilter Semaphore** über Upstash Redis (`global-limiter.ts`,
  ZSET+Lua, TTL): hält pro Objekt-Endpoint **global ≤ 2** über ALLE Instanzen (Autotask-Limit
  = 3/Objekt je Integration). Aktiv via `UPSTASH_REDIS_REST_*`; sonst In-Process-Fallback.
  **Kind-Pfade** (`…/Notes`, `…/Attachments`) buchen aufs echte Objekt-Budget (`TicketNotes`/
  `TicketAttachments`), nicht aufs Parent. 80 %-Frühwarn-Monitor in `rate-monitor.ts`.
- **429-Backoff** (`backoff.ts`): exponentiell `500ms · 2^n`, 4 Versuche (Autotask sendet keine
  Rate-Limit-Header → blind, konservativ).
- **Default-Reihenfolge: Autotask liefert IMMER älteste zuerst** (id-asc) und **sortiert
  serverseitig nicht** (B13). „Neueste zuerst"-Listen = `createDate`-Zeitfenster + Vollabruf +
  **client-seitiger** desc-Sort (NICHT Cursor-Paging). Datumsvergleiche im Filter funktionieren.
- **Entity-Wrapper** (`lib/autotask/entities/*`): dünne getypte Loader je Entität. Neue Entität
  = eine neue kleine Datei, kein Eingriff in den Kern. **Picklists/Labels** aus
  `entityInformation/fields` (gecacht), nicht hartkodiert (`picklists.ts` + `mappers.ts`).

---

## 4. Auth (zentrale Weiche `AUTH_MODE`)

`lib/auth/index.ts` wählt anhand `process.env.AUTH_MODE`: `"entra"` → `entra-provider`,
sonst (Default) → `mock-provider`. **Server-Code liest ausschließlich `SessionUser`** —
niemand greift direkt auf „den Login" zu. Umschalten = nur diese eine Env-Variable.

```ts
type Role = "agent" | "teamleiter" | "admin";
interface SessionUser {
  id: string;                 // Mock: userName · Entra: oid
  email: string; displayName: string;
  roles: Role[];              // werden aktuell NICHT ausgewertet → kein Rollen-Gating (B12)
  autotaskResourceId: number; // Mapping auf Autotask-Resource (nötig für „Meine Tickets")
}
```

- `getSession()` → `SessionUser | null`. `requireSession()` (in `app/(app)/layout.tsx`) erzwingt
  Login; Entra-User ohne Autotask-Resource → `/no-access`, sonst `/login`.
- **Mock** (`mock-provider.ts` + `mock-users.ts`): Cookie `mock_user` = userName → statischer
  Sandbox-User. Drei Mock-User: Demo Agent (29682903), **Demo Teamlead** (29682886), Demo Admin (4).
- **Entra** (`entra-provider.ts` + `authjs.ts`, Auth.js v5, OIDC, JWT-Session, keine DB): beim
  Sign-in E-Mail → Autotask-Resource (`resources.byEmail`), in JWT gecacht; ohne Treffer
  `atError="NO_RESOURCE"`. Rollen aktuell fix `["agent"]`.
- **Vertrieb-Bereich ist zusätzlich gated** (read-only): Allowlist von `autotaskResourceId` in
  `lib/auth/sales-access.ts` (Env `SALES_ALLOWED_RESOURCE_IDS`, **fail-closed**). Das **Page-Gate
  muss VOR dem Datenabruf** greifen (Layout-`notFound` leakt bei Streaming).

---

## 5. Feature-Inventar (was ist da + wie)

**Sidebar-Menü:** Übersicht · Meine Tickets · Teamtickets · Projekte · Firmen · Kontakte ·
Meine Zeiten · (Vertrieb, nur Allowlist). Jede Route hat ein layout-treues `loading.tsx`.

**Dashboard `/`** — 4 KPI-Kacheln (Meine Tickets [inkl. zusätzlicher Mitarbeiter] / Nicht
zugewiesen / **Meine Projekte** / Ball liegt bei mir; Count-Endpoint gecacht, klickbar →
Drill-down) + Balkendiagramm „Tickets pro Mitarbeiter" (Klick filtert Teamtickets) + Sektion
**„Offene Tickets"** (`dashboard/open-tickets.tsx`): offene Tickets team-weit im Teamlisten-Look,
Schnellfilter „Alle offenen / Nur nicht zugewiesene" (clientseitig über `GET /api/tickets/open`,
kein Seiten-Neuladen) + „Alle offenen anzeigen". KPI-Kacheln über **Container-Queries** (auf jeder
Breite gleich hoch).

**Gemeinsames mobiles Karten-System** — `components/tickets/ticket-card.tsx`: EINE Hierarchie für
alle mobilen Ticketlisten (Titel → „Firma · Nummer" → Status/Priorität/Queue/Bearbeiter →
Kontextdatum). Varianten `worklist` (→ „Fällig …") und `activity` (→ „Aktualisiert …", bei neuem
Ticket „Erstellt …"). Firmen/Kontakte (`searchable-table.tsx`) teilen Radius/Border/Focus/Hover —
keine Insel-Designs.

**Ticketlisten** — gemeinsame `components/tickets/tickets-list.tsx`: `/tickets/my` (server-
gefiltert auf Session-Resource, inkl. zusätzlicher Mitarbeiter), `/tickets/team` (alle, Pool-Blick,
Chart-Klick-Filter), `/tickets/ball` (letzte Aktivität vom Kunden). Filter (Status/Priorität/
Queue/Zuweisung) server-seitig, **Sortierung clientseitig**, Volltextsuche (`?q=`) debounced. Keine
Paginierung (`getTicketsAll`, Cap 500 mit Hinweis). **Bulk-Aktionen** (`bulk-bar.tsx`): Status/
Priorität/Queue/Zuweisen + „Mir zuweisen", KEIN neuer Schreibpfad (pro Ticket das bestehende
`PATCH /api/tickets/[id]`, max 3 parallel), **Undo** der letzten Aktion. Die Bulk-Leiste **ersetzt
die Filterzeile an gleicher Stelle** (Grid-Stack, konstante Höhe → kein Layout-Sprung).

**Ticketdetail `/tickets/[id]`** (`ticket-detail.tsx` + `meta-edit.tsx`): Inline-Edit (Status/
Priorität/Queue/Kategorie, Zuweisung Resource+Rolle, Firma-Wechsel mit Nullen der firmengebundenen
Refs, Kontakt/Gerät/Vertrag-Combobox, Beschreibung). **Zusätzliche Mitarbeiter**
(`TicketSecondaryResources`, anzeigen/hinzufügen/entfernen). **Chat-Sidebar** (`ticket-chat.tsx`,
**reines Kundenfenster**, 45 s Polling, jede Nachricht an Kunden mit Bestätigungsdialog; Notiz wird
vor dem Anlegen per `plainTextFromRich` zu Klartext — Autotask zeigt `TicketNotes.description` als
Rohtext, HTML lebt nur in der Kunden-Mail). **Zeit erfassen** (`time-entry-dialog.tsx` + Stoppuhr)
und **interne Notiz** (`note-form.tsx`, noteType 2). **Status-Workflow:** Schließen/Öffnen verlangt
Pflichtnotiz. **Anhänge** lesen/laden/hochladen (max 10 MB; Löschen per API nicht möglich → 405).
**Verlauf+Undo** nur für Feldänderungen reversibel (`lib/history.ts` + `history-sheet.tsx`); Notizen
(405)/Mails kann die API nicht zurücknehmen.

**Projekte** — `/projekte` (`components/projects/projects-list.tsx`): Meine/Alle-Umschalter + Suche
(„Meine" = selbst **geleitet** `projectLeadResourceID` ODER eigene **Projektaufgabe**). Detailseite
mit Phasen-/Aufgaben-Panels. **Schreibfelder verifiziert:** nur **Leiter + Fällig-Datum** schreibbar
(Status = stiller No-Op, Fortschritt/Start nicht); Gate `PROJECT_WRITES_ENABLED`.

**Firmen** — `/companies` (`companies-table.tsx`: aktive Firmen, Kundenart-Filter Default „Kunde",
Spalte „offene Tickets" aus EINEM gebündelten Abruf). `/companies/[id]` **Kundenakte**
(`company-tabs.tsx` + `kundenakte-panels.tsx`): Stammdaten + 5 KPI-Kacheln + Tabs Offen/
Abgeschlossen/Kontakte/Geräte/Verträge + „Neues Ticket für diese Firma".

**Kontakte** — `/contacts` (server-`contains`-Suche, Firma-Filter-Combobox) + `/contacts/[id]`.

**Vertrieb (read-only, gated)** — `/vertrieb` (Übersicht) + `/vertrieb/{rechnungen,angebote,
vertraege}` (+ Detailseiten). Gruppierte Listen (`vertrieb/grouped-list.tsx`); Jahresfilter (reine
Jahresauswahl, `lib/vertrieb/year-window.ts`). Spaltenausrichtung gruppenübergreifend nur über feste
Spaltenbreiten (`Column.width` → `table-fixed`).

**Globale Suche** — **Spotlight-Palette** (`command-palette.tsx`, Cmd/Strg+K): große Leiste, **4
Spalten parallel** (Firma · Kontakte · Ticket-Name · Ticket-Nummer), je 8 Treffer. **`/search`**:
dieselben 4 Spalten als volle Listen mit „Mehr laden" pro Spalte (Cursor-Token) + Gesamtzahl.
Responsiv 4/2/1 Spalten (≥1280 / ≥640 / mobil).

**Tabellen-Veredelung:** Spaltenbreiten gedeckelt + voller Text bei Hover (`truncated-text.tsx`),
Spalten per Drag&Drop umsortierbar (`hooks/use-column-order.ts`, native DnD, localStorage je Tabelle).
**Skeletons** (`components/skeletons.tsx` + jede `loading.tsx`) spiegeln das echte Raster.

**Theming/Branding — Farbsystem v2 (warm-achromatisch, „ElevenLabs").** Light+Dark **automatisch**
über semantische OKLCH-Tokens (`globals.css`), AA in Hell+Dunkel. **Primary = Warm-Schwarz/Off-White,
kein Indigo mehr;** Buntfarbe nur als kleines Funktionssignal (Badges/Charts), nie als Fläche. Alle
Grautöne mit warmem Unterton. **Badges entschärft** (zentral in `mappers.ts`): nur rot=`destructive`
laut, sonst `outline`/`secondary`; Priorität „Hoch"=schwarz; die alte rot-amber-grün-Ampel ist
ersetzt. Default-Badge schwarz/weiß. Audit: `scripts/color-audit.mjs`. Keine manuellen `dark:`-Farb-
Overrides, kein `bg-blue-*`/Hex. **Autotask-Logo** oben links (statischer Import → gehashte URL).

---

## 6. Datei-Karte (wo liegt was)

- **`app/(app)/`** — geschützte Shell (`layout.tsx`: `requireSession`, Sidebar+Header+Command-Palette
  +Toaster, Padding `p-4 md:p-6`, Sektions-`gap-6`). Seiten: `page.tsx` (Dashboard),
  `tickets/{my,team,ball,[id]}`, `projekte`, `projekte/[id]`, `companies`, `companies/[id]`,
  `contacts`, `contacts/[id]`, `vertrieb/{,rechnungen,angebote,vertraege}` (+ `[id]`), `search`,
  `zeiten`, `admin`.
- **`app/api/`** — BFF-Routen, **jede** durch `guardApi` (CSRF+Session+Rate-Limit) abgesichert.
  Schreiben: `tickets` (POST), `tickets/[id]` (PATCH), `tickets/[id]/{chat,note,time,attachments,
  checklist,secondary-resources}`, `tickets/merge`, `tickets/notify-assignment`, `projects/[id]`.
  Lesen: `tickets/[id]`, `tickets/{search,open,by-company}`, `search`, `companies`, `contacts`,
  `contacts/{search,[id]}`, `resources`, `resources/[id]/roles`, `picklists`, Attachment-Download,
  `auth/[...nextauth]`.
- **`components/`** — `ui/` (vendored shadcn; NUR hier arbitrary Tailwind-Values erlaubt),
  Feature-Slices (`tickets/`, `companies/`, `contacts/`, `projects/`, `vertrieb/`, `search/`,
  `time/`, `dashboard/`), Rahmen (`app-sidebar`, `nav-*`, `header-*`, `mobile-bottom-nav`,
  `command-palette`, `theme-*`, `mock-user-switcher`), Querschnitt (`skeletons`, `truncated-text`,
  `searchable-table`, `page-header`, `url-tabs`, `history-sheet`, `data-error`, `status-indicator`,
  `priority-indicator`).
- **`lib/`** — `auth/*` (Session/Provider/Mock/Entra/Index/`sales-access`), `autotask/*` (client,
  limiter, global-limiter, backoff, rate-monitor, types, mappers, conversation, new-ticket,
  attachments-shared, `entities/*`), `security/api-guard.ts`, `vertrieb/year-window.ts`,
  `history.ts`, `branding-server.ts`, `format.ts`, `utils.ts`.
- **`hooks/`** — `use-column-order.ts`, `use-mobile.ts`, `use-record-nav.ts`.
- **`middleware.ts`** — erzwingt CSP (Nonce + `strict-dynamic`, kein `unsafe-inline`/`eval` im
  `script-src`). **`e2e/`** — Playwright-Smoke. **`scripts/`** — Wegwerf-API-Verifikation gegen
  die Sandbox + `color-audit.mjs`.

---

## 7. Weichen (alle Schalter — wo/wie gestellt)

| Weiche | Wo | Default / Wert |
|---|---|---|
| **AUTH_MODE** | `lib/auth/index.ts` | Prod: `entra`. **Fail-closed:** in `NODE_ENV=production` muss explizit `entra`/`mock` gesetzt sein (kein stiller Mock). Ausnahme `next build`. |
| **PROD-Backend (kein Sandbox-Schutz)** | `AUTOTASK_*` → Produktion | **Keine Runtime-Sperre.** Schreibpfade wirken sofort+unumkehrbar. Test-Schreiben NUR an Prod-Testticket **56313 „ZZZ TESTTICKET"** (SSIG-IT GmbH `companyID 0`, Kontakt `30684646`). |
| **Vertrieb-Allowlist** | `lib/auth/sales-access.ts`, Env `SALES_ALLOWED_RESOURCE_IDS` | fail-closed: nur gelistete `autotaskResourceId` sehen `/vertrieb`. Page-Gate vor Datenabruf. Prod-IDs setzen. |
| **API-Guard / Rate-Limit** | `lib/security/api-guard.ts` (alle `/api`-Routen) | `guardApi`: CSRF + Session + Rate-Limit-Presets (`read`/`search`/`write`/`email`/`emailRecipient`/`merge`), Upstash + In-Process-Fallback. |
| **CSP** | `middleware.ts` | Erzwungen: Nonce + `strict-dynamic`, kein `unsafe-inline`/`unsafe-eval` im `script-src`. |
| **Schreib-Whitelist Ticket** | `app/api/tickets/[id]/route.ts` `EDITABLE_FIELDS`/`STRING_FIELDS` | nur gelistete Felder; Zuweisung Resource+Rolle nur zusammen. |
| **Projekt-Schreiben** | `PROJECT_WRITES_ENABLED` | nur Leiter + Fällig-Datum schreibbar (Status=No-Op, Rest nicht). |
| **Default-Queue neues Ticket** | `lib/autotask/new-ticket.ts` `NEW_TICKET_DEFAULT_QUEUE` | `29682833` (Level I-Support). |
| **Chat-noteTypes / Inbound** | `lib/autotask/conversation.ts` | outbound 18; Inbound = `createdByContactID` gesetzt ODER Body-Marker „Durch eingehende E-Mail-Verarbeitung erstellt" (echte Antworten noteType 3, `createdByContactID` ggf. NULL). Prod-verifiziert (56313). |
| **Merge-Cap** | `app/api/tickets/merge/route.ts` | max **10** Quelltickets/Request. |
| **Caps / Cache** | div. | `COMPANIES_CAP 1000`, `BALL_FETCH_CAP 500`, `SEARCH_PAGE 25`, Palette 8; `unstable_cache`: picklists 60 s, KPIs 180 s, tickets-per-resource 300 s, sidebar-counts 120 s. |
| **Globaler Thread-Limiter** | `lib/autotask/global-limiter.ts`, Env `UPSTASH_REDIS_REST_URL/_TOKEN` | gesetzt → global ≤ 2/Objekt über alle Instanzen; leer → In-Process. |

---

## 8. Environment-Variablen (vollständig)

**Immer (Autotask-Backend, Produktion):**
`AUTOTASK_BASE_URL` (Zone, **MUSS auf `/V1.0` enden**) · `AUTOTASK_API_USERNAME` ·
`AUTOTASK_API_SECRET` (`$`/`#` → in `.env.local` einfache Quotes; bei `docker --env-file` KEINE
Quotes) · `AUTOTASK_INTEGRATION_CODE`.

**Auth-Weiche:** `AUTH_MODE=mock | entra` (in Prod zwingend explizit, fail-closed).

**Nur bei `entra`:** `AUTH_SECRET` · `ENTRA_CLIENT_ID` · `ENTRA_CLIENT_SECRET` · `ENTRA_TENANT_ID`
(tenant-spezifischer Issuer `…/<tenant>/v2.0`, in `lib/auth/authjs.ts` verdrahtet) · `AUTH_URL` ·
`AUTH_TRUST_HOST=true` (hinter Caddy/Non-Vercel). `ENTRA_EMAIL_LOOSE_MATCH` war Sandbox-Workaround
→ in Prod weggelassen.

**Vertrieb:** `SALES_ALLOWED_RESOURCE_IDS` (Komma-Liste erlaubter `autotaskResourceId`).

**Chat-Kundenmail:** `RESEND_API_KEY` · `RESEND_FROM` · `AUTOTASK_INBOUND_MAILBOX`.

**Optional:** `NEXT_PUBLIC_ORG_NAME` (Branding-Override; sonst Auto aus `companyID 0`) ·
`UPSTASH_REDIS_REST_URL`/`_TOKEN` (globaler Thread-Limiter + Rate-Limit; leer → In-Process-Fallback).

Details + Redirect-URI + Docker/Vercel + Secret-Quoting: [`../DEPLOY.md`](../DEPLOY.md).

---

## 9. UX-/UI-Standards (verbindlich beim Bauen)

- **Bedienhöhe:** Standalone-Controls (Button/Select/Tab/Suche) `h-11` (mobil <640) → `sm:h-9`
  (≥640). **Kein** `sm:h-7`/`sm:h-8`, keine `sm:h-9!`-`!important`-Hacks (Basis-`SelectTrigger`
  liefert `sm:h-9`). Icon-only mobil ≥44px (`size-11`, ggf. `sm:size-9`); die 44px gelten **nur**
  unter `sm`.
- **Listen-Breakpoint:** Karten→Tabelle **immer bei `xl`** (`grid-cols-1 [md:grid-cols-2]
  xl:hidden` + `hidden xl:block`). **Ticket-Karten bleiben bewusst einspaltig** (dichte Karte) —
  dort **kein** `md:grid-cols-2`.
- **Abstände:** Sektionen `gap-6`, Toolbars `gap-2`/`gap-3`, **`gap-*` statt `space-y-*`**. Seiten-
  Padding aus `app/(app)/layout.tsx` (`p-4 md:p-6`).
- **Farben/Komponenten:** nur semantische Tokens (siehe §5 Theming), shadcn-only, keine rohen
  `<a>/<button>/<input>` (Links als `<Button variant=… render={<a … aria-label=… />}>`). Badges/
  StatusDot über `mappers.ts`. Skeletons spiegeln das echte Layout.
- **Bewusst SO (kein Bug):** Spotlight-Suche absichtlich groß (`command-palette` h-14, `search-box`
  h-12 — NICHT verkleinern) · Dashboard-KPI-Raster `grid-cols-2 lg:grid-cols-4` · Toolbar-Zähler
  („X von Y") = gedämpfter Text (kein Badge), Eltern-Toolbar `items-center` · Detail-Header (Firma/
  Projekt/Ticket) haben absichtlich eigenes Layout (nicht auf `PageHeader` zwingen) ·
  `ResponsiveDialog`-Muster (Footer-Leck via `pb-0`/`mb-0` gelöst) bei neuen Dialogen beibehalten.
- **Offene Mikro-Politur (Low/Nit, optional):** `vertrieb/invoices-list` Karte (Firma·Datum
  Umbruch), `dashboard/my-projects-section` Leerzustand → `Empty`-Komponente. Sonst sauber.

---

## 10. Arbeitsregeln für die nächste KI (Kurzfassung)

- **`CLAUDE.md` ist verbindlich.** UI nur aus shadcn + semantischen Tokens, Deutsch + echte Umlaute
  (ü ö ä ß), keine Emojis. Pro Slice: verifizieren → `typecheck`/`lint`/`build` grün → Browser
  Hell/Dunkel/Mobile (Mock-Dev, §2) → **EIN kleiner Commit** → `DECISIONS.md` nachziehen.
- **Commits als Paul Katio `<paulkatio@gmail.com>`, KEIN `Co-Authored-By`.**
- **Nichts „fertig" behaupten ohne echten Test.** ⚠️ Backend ist **PRODUKTION** — Schreibtests
  treffen echte Kunden (kein Sandbox-Schutz). API/Felder/Schreibpfade IMMER gegen die **Sandbox**
  prüfen (Creds in gitignored `.env.sandbox.local`), nie gegen Prod; Read-only-Smoke gegen Prod ok.
  **Der Autotask-MCP zeigt PROD, nicht die App-Sandbox** — nicht zur Sandbox-Verifikation nutzen.
- **Befunde/Entscheidungen** wandern nach `DECISIONS.md` (Gedächtnis über Sessions).
