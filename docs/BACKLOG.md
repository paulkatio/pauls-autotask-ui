# BACKLOG – Aufgaben für Claude Code

Arbeite **von oben nach unten**. Jedes Item hat: Ziel, Schritte, Abhängigkeit,
"Fertig wenn". Hake nichts ab, bevor "Fertig wenn" erfüllt ist. Trage relevante
Befunde in `docs/DECISIONS.md` ein.

Legende Abhängigkeit: das genannte Item muss vorher fertig sein.

---

## STAND (2026-06-04) — was offen ist

Gesamtüberblick: **[`STATE.md`](STATE.md)**. Der MVP gegen die **Sandbox** ist fertig:
B00–B25, A1–A3, B1–B4 (Firmen/Kontakte), C1–C2 (Suche), BULK + FB1–FB7 (Tabellen-/UX-
Feinschliff), sowie Folge-Slices: Bulk-Undo, Spalten-Truncate+Hover, Spalten-Drag&Drop,
Ampel-Badges, Spotlight-Suche + `/search`-Paginierung, layout-treue Skeletons, Logo.

**Offen / Blocker vor Produktiv-Cutover** (Details unten + in DECISIONS):
- **B16a Entra-ID live** – Code fertig, fehlt: echter OIDC-Round-Trip + E-Mail→Resource-
  Mapping in Prod; dann `AUTH_MODE=entra`.
- **Prod-Autotask-Creds** – `AUTOTASK_*` von Sandbox auf Prod (manuell, eigener Schritt).
- **B17 Kundenmail via Resend** (BLOCKER) – Workflow/UDF-Race ersetzen durch app-eigene
  Mail mit `Reply-To` = Autotask-Inbound.
- **B17a Inbound-noteType** – aus Sandbox-Historie geklärt: Inbound = noteType 3 +
  `createdByContactID` (nicht 101); Chat-Fetch + Notify-Schalter gefixt (2026-06-05).
  Offen für Prod: nur noch Threading ohne Autotask-Token.
- Aufgeschoben: Rollen-Gating (B12), Anhang-Löschen (API 405).

---

## B00 — Phase 0: API-Verifikation
**Abhängigkeit:** keine (das ist der Start)
**Ziel:** Die Blocker-Unsicherheiten gegen die Sandbox klären.
**Schritte:** Folge `docs/PHASE-0-API-VERIFICATION.md` Punkt V1–V6. Lege bei Bedarf
`scripts/verify-api.ts` an.
**Fertig wenn:** DECISIONS.md Teil A hat zu V1–V6 je einen klaren Eintrag (auch
"nicht möglich / Workaround" zählt). Ein Blocker-Befund, der den Blueprint
umwirft, wurde an Paul gemeldet.

---

## B01 — Projekt-Bootstrap
**Abhängigkeit:** B00
**Ziel:** Lauffähiges Next.js-Grundgerüst.
**Schritte:**
- Next.js (App Router) + TypeScript anlegen.
- shadcn/ui per offiziellem CLI initialisieren (`npx shadcn@latest init`),
  Tailwind v4. Resultierende `components.json`-Felder (base/style/iconLibrary/
  aliases/tailwindVersion) in DECISIONS.md festhalten.
- Einen Package-Manager wählen und konsistent nutzen.
**Fertig wenn:** `dev` startet, leere Startseite rendert, kein Build-Fehler.

---

## B02 — Theme & Dark Mode
**Abhängigkeit:** B01
**Ziel:** Light/Dark/System-Umschaltung.
**Schritte:**
- `next-themes` einbinden, Theme-Provider im Root-Layout.
- Theme-Toggle-Komponente (shadcn `DropdownMenu` + Icon) für den Header.
- Sicherstellen: ausschließlich semantische Tokens, keine `dark:`-Farb-Overrides.
**Fertig wenn:** Umschalten zwischen Hell/Dunkel/System funktioniert sichtbar,
ohne Flackern beim Laden.

---

## B03 — App-Shell (Sidebar + Header)
**Abhängigkeit:** B02
**Ziel:** Navigationsgerüst.
**Schritte:**
- shadcn `Sidebar` mit Links: Dashboard, Meine Tickets, Teamtickets, Suche, Admin.
- Header mit Theme-Toggle + Platzhalter-User-Menü.
- Aktiver Navigationszustand korrekt.
**Fertig wenn:** Alle Routen aus dem Blueprint sind navigierbar (vorerst leere
Seiten), Layout sitzt auf Desktop und Mobile.

---

## B04 — Auth-Abstraktion + Mock-Provider
**Abhängigkeit:** B03
**Ziel:** Login-Schicht gemäß CLAUDE.md §4.
**Schritte:**
- `lib/auth/session.ts` (Typ `SessionUser`), `provider.ts` (Interface),
  `mock-provider.ts`, `index.ts` (Auswahl per `AUTH_MODE`).
- Mock-Provider: Dropdown im Header (nur bei `AUTH_MODE=mock`) zur Auswahl echter
  Sandbox-Resources (Mapping aus V6). Auswahl in einem Cookie.
- Geschützte Routen lesen `getSession()`; ohne Session -> `/login`.
**Fertig wenn:** Man kann sich als unterschiedliche Sandbox-User "einloggen",
`SessionUser` ist überall serverseitig verfügbar, `entra-provider.ts` existiert als
dokumentiertes Stub mit identischer Signatur.

---

## B05 — Autotask-Client (server-only)
**Abhängigkeit:** B00, B01
**Ziel:** Zentrale, sichere Brücke zur Autotask REST API.
**Schritte:**
- `lib/autotask/client.ts`: liest Env, baut Requests, Concurrency-Limiter
  (max 3/Tabelle), 429-Backoff.
- `lib/autotask/types.ts`: getypte Modelle gemäß verifizierten Feldern (V5).
- Niemals Creds nach außen geben.
**Fertig wenn:** Ein einfacher serverseitiger Testaufruf (z. B. 1 Ticket holen)
liefert echte Sandbox-Daten; bei künstlichem 429 greift Backoff.

---

## B06 — Picklists-Endpoint + Mapper
**Abhängigkeit:** B05
**Ziel:** Lesbare Labels statt roher IDs.
**Schritte:**
- `GET /api/picklists` lädt Status/Priority/Queue-Picklists (gecacht 30–60 s).
- Mapper-Funktionen ID -> Label in `lib/autotask/mappers.ts`.
**Fertig wenn:** UI kann Status/Priorität/Queue als Klartext anzeigen.

---

## B07 — Meine Tickets (Liste)
**Abhängigkeit:** B04, B06
**Ziel:** Erste echte Datenansicht.
**Schritte:**
- `GET /api/tickets/my`: `Tickets/query`, Filter `assignedResourceID = session`,
  serverseitiges Paging (`nextPageUrl`).
- DataTable (Table + Pagination), Spalten: Nummer, Titel, Company, Status,
  Priorität, Fälligkeit. Filterleiste (Status/Priorität/Queue).
- Lade-Skeletons, Fehler-`Alert`, leerer Zustand `Empty`.
**Fertig wenn:** Eingeloggter User sieht seine echten Sandbox-Tickets, Filter und
Paging funktionieren, Sichtbarkeit serverseitig erzwungen.

---

## B08 — Ticketsuche
**Abhängigkeit:** B07
**Ziel:** Schnell ein Ticket finden.
**Schritte:** `GET /api/tickets/search` über Nummer/Titel/Company/Kontakt; einfache
Suchseite mit Ergebnis-Tabelle.
**Fertig wenn:** Treffer aus der Sandbox erscheinen, Klick führt ins Detail.

---

## B09 — Ticketdetail (read)
**Abhängigkeit:** B07
**Ziel:** Aufgeräumte Detailseite.
**Schritte:**
- `GET /api/tickets/[id]`: Ticket + Company + Contact + CI + TicketNotes +
  TimeEntries (read).
- 3-Spalten-Layout (Meta / Aktivität / Platzhalter Chat) über `Resizable`/Grid +
  `Card`. Mobile: untereinander.
- Notes + TimeEntries chronologisch anzeigen.
**Fertig wenn:** Reale Detaildaten erscheinen vollständig und lesbar.

---

## B10 — Chat-Sidebar: Lesen (Polling)
**Abhängigkeit:** B09, V1
**Ziel:** Konversation als Chat-Verlauf.
**Schritte:**
- `GET /api/tickets/[id]/chat`: TicketNotes chronologisch.
- Chat-UI (Card + ScrollArea + Bubbles + Zeitstempel + Sender). Polling-Intervall
  gemäß V2.
- Pflicht-Hinweis "Nachrichten werden per E-Mail zugestellt".
**Fertig wenn:** Verlauf eines echten Tickets erscheint als Chat, aktualisiert sich
per Polling.

---

## B11 — Chat-Sidebar: Senden (Outbound)
**Abhängigkeit:** B10, V1 (E-Mail-Verhalten verifiziert)
**Ziel:** Nachricht senden = TicketNote anlegen.
**Schritte:**
- `POST /api/tickets/[id]/chat` legt TicketNote mit der in V1 freigegebenen
  noteType/publish-Kombination an.
- Optimistisches UI-Update + Bestätigung; Fehler sauber anzeigen.
- Falls V1 ergab "Mail nur per Workflow": in der UI klar machen, dass Versand von
  der Autotask-Konfiguration abhängt.
**Fertig wenn:** Gesendete Nachricht erscheint als neue Note im Verlauf; falls
verifiziert, ist der E-Mail-Versand über NotificationHistory belegt.

---

## B12 — Teamtickets
**Abhängigkeit:** B07
**Ziel:** Team-Sicht für Teamleiter/Admin.
**Schritte:** `GET /api/tickets/team` (Filter queueID/departmentID), nur für
Rollen Teamleiter/Admin (serverseitig). Gleiche DataTable wie B07.
**Fertig wenn:** Berechtigte sehen Teamtickets, Agents nicht.

---

## B13 — Dashboard: KPIs + Fokuslisten
**Abhängigkeit:** B07
**Ziel:** Startseite "Meine Arbeit heute".
**Schritte:**
- KPI-Cards: Offen / Überfällig / Heute fällig / SLA-gefährdet (Zähler über
  gefilterte Queries; leichter Cache).
- Fokuslisten: "Meine kritischen Tickets", "Zuletzt bearbeitet".
**Fertig wenn:** KPIs stimmen plausibel mit der Sandbox überein, Klick führt in die
gefilterte Liste / ins Ticket.

---

## B14 — Dashboard: Team-Chart
**Abhängigkeit:** B12, B13
**Ziel:** Visualisierung für Teamleiter/Admin.
**Schritte:** shadcn-`Chart` (Bar oder Donut): Tickets pro Queue oder Resource.
**Fertig wenn:** Chart rendert mit echten Sandbox-Zahlen, Light + Dark Mode korrekt.

---

## B15 — Should-haves (nur nach Verifikation)
**Abhängigkeit:** je nach Feature B11/B13 + Phase-0-Befund
**Ziel:** Mehrwert ohne Risiko.
**Schritte (jeweils nur wenn freigegeben):**
- Inline-Statusänderung in Listen via `PATCH /api/tickets/[id]` (nur verifizierte
  Felder, V5).
- TimeEntry-Create (nur falls V3 = schreibbar).
- SLA-Highlighting im Dashboard (nur mit verifizierten SLA-Feldern, V5).
**Fertig wenn:** Jeweiliges Feature funktioniert und ist durch einen echten
Sandbox-Aufruf belegt.

---

## B15a — Slice 1: Zeiteintrag erfassen (Ticketdetail) — ERLEDIGT (2026-06-03)
**Abhängigkeit:** B09; Verifikation „Ticket-Bearbeitung" (DECISIONS 2026-06-03)
**Umgesetzt:** Dialog „Zeit erfassen" (Datum/Von/Bis→Dauer, Tätigkeitsart,
Zusammenfassung, „an die Lösung anhängen"); Route `POST /api/tickets/[id]/time`;
Rolle server-seitig. Belegt: TimeEntry-ids 30550/30551. Siehe DECISIONS „B15a".
**Ziel:** Aus dem Ticket heraus einen Zeiteintrag anlegen.
**Schritte:**
- Schreib-Route `POST /api/tickets/[id]/time` (server-only, BFF).
- Felder: `resourceID` (= Session-Resource), `roleID` aus `ResourceRoles/query`
  (nur Rollen, die die Resource hält), `startDateTime`+`endDateTime` (bei
  Service-Tickets Pflicht), `summaryNotes`; `hoursWorked` aus Differenz ableitbar.
- Form aus shadcn (`FieldGroup`/`Field`, `Select`, `Textarea`, `sonner`-Toast).
**Fertig wenn:** Zeiteintrag erscheint in der Aktivitätsliste; durch echten
Sandbox-Aufruf belegt (vgl. TimeEntry id 30549).

---

## B15b — Slice 2: Einfache Ticket-Felder bearbeiten — ERLEDIGT (2026-06-03)
**Abhängigkeit:** B09; Verifikation 2026-06-03
**Umgesetzt:** Inline-Selects in der Meta-Spalte (Status/Priorität/Queue,
Kategorie→Unterkategorie mit parentValue-Filter, Zuweisung Resource+Rolle
gekoppelt) via `PATCH /api/tickets/[id]`. Siehe DECISIONS „B15b".
**Ziel:** Status / Priorität / Queue / Zuweisung / Kategorie inline/Detail ändern.
**Schritte:**
- Schreib-Route `PATCH /api/tickets/[id]` (Whitelist nur dieser Felder).
- Werte aus Picklists (Status/Priorität/Queue, V5) bzw. `issueType`→`subIssueType`
  (Unterkategorie clientseitig nach `parentValue` filtern).
- **Zuweisung:** `assignedResourceID` + `assignedResourceRoleID` zusammen senden.
**Fertig wenn:** Änderungen server-seitig gespeichert, optimistisch in der UI,
durch echten Sandbox-Aufruf belegt.

---

## B15c — Slice 3: Firmenabhängige Referenzen (Firma/Kontakt/Gerät/Vertrag) — ERLEDIGT (2026-06-03)
**Abhängigkeit:** B15b; Verifikation 2026-06-03
**Umgesetzt:** suchbare Comboboxen (Popover+Command) für Kontakt/Gerät/Vertrag,
firmengefiltert; „Firma ändern"-Dialog mit Firmensuche; Firmenwechsel nullt
contactID/configurationItemID/contractID + **companyLocationID** im selben PATCH.
Siehe DECISIONS „B15c".
**Ziel:** companyID, contactID, configurationItemID, contractID bearbeiten.
**Schritte:**
- Auswahllisten je Referenz via `{Entity}/query` gefiltert auf `companyID` des
  Tickets (Contacts/ConfigurationItems/Contracts).
- **Firmenwechsel:** im selben PATCH kompatible `contactID`/`configurationItemID`/
  `contractID` mitsenden bzw. auf `null` setzen (keine Auto-Kaskade; Server lehnt
  Mismatch ab). „Parent Company"-Kontakte sind erlaubt.
- Saubere Fehlermeldung an die UI bei Zugehörigkeits-Verletzung.
**Fertig wenn:** Referenzen änderbar, Firmenwechsel-Fall funktioniert, durch echten
Sandbox-Aufruf belegt.

---

## B16 — Entra ID + Deployment (separate, späte Phase)
**Abhängigkeit:** alle Kern-Items (B07–B13) stabil
**Ziel:** Produktionsreife.

### B16a — Entra-ID-Login — ERLEDIGT (2026-06-03)
Auth.js v5 / Microsoft-Entra-ID, JWT-Session, in die Auth-Abstraktion eingebettet
(Mock unverändert), `requireSession()` (/login bzw. /no-access), email→resourceID
im jwt-Callback gecacht (`resources.byEmail`), NO_RESOURCE → /no-access ohne
fabrizierte resourceId, Node-Runtime, kein middleware.ts. Siehe DECISIONS „B16a".
Offen: echter OIDC-Round-Trip (Paul, sobald Entra-App-Registrierung steht) +
Sandbox-Mail-Mapping beachten.

### B16b — Deployment-Paketierung — ERLEDIGT (Paketierung, 2026-06-03)
`output:'standalone'`, `Dockerfile` (multi-stage, node:22-alpine, non-root,
server.js), `.dockerignore` (keine Secrets/.env im Image), `Caddyfile.example`,
`DEPLOY.md` (Docker+Caddy UND Vercel, Env-Liste, Prod-Redirect-URI-Hinweis).
Verifiziert: standalone-Build grün; Docker-Image (Mock) startet, `/login` → 200,
`/` → 307 /login; keine `@vercel/*`-Abhängigkeit. Kein echtes Remote-Deploy
(Hosting-Ziel + Domain offen).
**Offen (separater Schritt):** reales Deploy auf Zielplattform; `AUTOTASK_*`
Sandbox → Prod (nach Freigabe); davor B17/B17a.
**Fertig wenn:** Login per M365 auf der Zielplattform; Umschalten Mock <-> Entra
nur über `AUTH_MODE`.

---

## B17 — Pre-Production: Kundenmail app-eigen via Resend (BLOCKER vor echtem Kundeneinsatz)
**Abhängigkeit:** B11
**Ziel:** Timing- und Leak-Risiko der UDF-gesteuerten Workflow-Mail vollständig
eliminieren (siehe DECISIONS „B11 … Option A").
**Schritte:**
- Kundenmail beim Chat-Senden NICHT mehr über die Autotask-Workflow-Regel (UDF
  „Kunde benachrichtigen") auslösen, sondern **app-eigen via Resend** versenden.
- `Reply-To` auf das **Autotask-Eingangspostfach** setzen, damit Kundenantworten
  per Inbound-Processing wieder als TicketNote (noteType 101) am Ticket landen
  (Antwort-Threading).
- UDF-Set/Reset-Logik aus dem Sende-Pfad entfernen; Schalter „Kunde
  benachrichtigen" steuert dann direkt den app-eigenen Versand.
**Fertig wenn:** Senden mit Schalter AN verschickt die Mail über Resend (belegt),
ohne UDF zu setzen; keine Mail bei AUS; kein „stuck Ja"-Leck mehr möglich.

---

## B17a — Pre-Production: Inbound-noteType in Prod bestätigen
**Abhängigkeit:** Prod-Mailverarbeitung steht (Nähe B17)
**Ziel:** Sicherstellen, dass eingehende Kundenantworten im Chat erscheinen.

**TEILWEISE GEKLÄRT (2026-06-05, aus Sandbox-Historie — `docs/B17-DISCOVERY.md`):** Echte
Kundenantworten sind **`noteType 3` + `createdByContactID`**, NICHT 101 (mandantenweit
0× 101). Chat-Fetch deshalb auf OR-Gruppe umgestellt (`byTicketConversation`: Typen
18/101 ODER `createdByContactID` gesetzt) + Notify-Schalter zurück in die UI; an
historischen Daten (Ticket 11807) belegt. **Offen für Prod bleibt nur noch:**
(a) frische Antwort kommt 2026 ebenfalls als 3+Kontakt an; (b) **Threading geklärt
(Paul, 2026-06-05):** Ticketnummer im Betreff → Antwort threadet zurück ans Ticket
(kein `[Ticket#…]`-Token nötig); nur noch einmaliger Prod-Gegencheck mit echter
Inbound-Mailbox als Reply-To. **Resend = einziger Weg, kein Notify-Toggle.**
**Problem:** Der Chat filtert auf `CONVERSATION_TYPE_IDS` = **18 (outbound) / 101
(inbound)**. Dass eine echte Antwort als **noteType 101** ankommt, ist eine
**Annahme** (Sandbox kann keine echte Mail empfangen, DECISIONS V2). Kommt sie in
Prod mit anderem noteType, **erscheint sie NICHT im Chat**.
**Schritte:**
- Sobald Prod-Mail steht: echte Antwort an ein Test-Ticket schicken.
- `TicketNotes/query` (Filter `ticketID`) → tatsächlichen `noteType` +
  `createdByContactID` prüfen.
- `CONVERSATION_TYPE_IDS` / `directionOf` in `lib/autotask/conversation.ts`
  bestätigen oder anpassen.
- Optional: Near-Realtime via **`TicketNoteWebhook`** statt 45-s-Polling (V4).
**Fertig wenn:** Eingehende Kundenantwort erscheint im Chat (belegt), noteType in
DECISIONS bestätigt.

---

## Nachtlauf 2026-06-04 — Funktionslücken & Politur

### B18 — Neues Ticket erstellen — ERLEDIGT (2026-06-04)
**Abhängigkeit:** B15b (Schreibpfad-Disziplin), Verifikation Create 2026-06-04
**Umgesetzt:** `POST /api/tickets` (Whitelist) + `NewTicketDialog` (Firma-Suchcombobox
→ firmengefilterter Kontakt, Titel/Beschreibung, Status=Neu/Priorität=Mittel-Default,
Queue, Kategorie→Unterkategorie, Zuweisung Resource+Rolle gekoppelt). Erfolg →
Redirect ins neue Ticketdetail + Toast. „Neues Ticket"-Button in allen Listen-Headern.
Hilfsrouten `GET /api/contacts?companyId=`, `GET /api/resources`. Verifiziert: Ticket
43181 (API) + 43182 (UI), beide an Test-Firma, danach geschlossen. Siehe DECISIONS
„Slice 1". **Befund:** Autotask verlangt zusätzlich queueID ODER Zuweisung (Client-Guard).
**Fertig wenn:** Ticket über die UI anlegbar, Pflicht/Constraints sauber abgefangen,
durch echten Sandbox-Create belegt. ✓

### B19 — Interne Notiz (Aktivität-Feed) — ERLEDIGT (2026-06-04)
**Abhängigkeit:** B09; V1 (noteType/publish-Sichtbarkeit)
**Umgesetzt:** „Neue Notiz"-Inline-Formular im Aktivität-Bereich; `POST
/api/tickets/[id]/note` → `ticketNotes.createInternal` (fest noteType 2 / publish 1).
NIE noteType 18, NIE UDF. Verifiziert: Notes 29926308/29926309 intern, UDF
unverändert. Siehe DECISIONS „Slice 2".
**Fertig wenn:** Notiz erscheint nach Erfolg im Feed, garantiert nicht
kundensichtbar, durch echten Sandbox-Aufruf belegt. ✓

### B20 — Stoppuhr am Ticketdetail — ERLEDIGT (2026-06-04)
**Abhängigkeit:** B15a (Zeit-erfassen-Dialog)
**Umgesetzt:** Client-seitige Stoppuhr (Start/Pause/Stopp/Reset) im Zeiten-Header;
Stopp öffnet den bestehenden `TimeEntryDialog` mit Von/Bis vorbefüllt (kontrollierter
Modus). Kein neuer API-Pfad. Siehe DECISIONS „Slice 3".
**Fertig wenn:** Stoppuhr läuft, Stopp füllt den Zeit-Dialog korrekt vor, im Browser
belegt. ✓

### B21 — Command-Palette (Cmd/Ctrl+K) — ERLEDIGT (2026-06-04)
**Abhängigkeit:** B08 (Suche)
**Umgesetzt:** Globale `CommandDialog`-Palette (Navigation + Ticketsuche), Shortcut
Cmd/Ctrl+K, auch über die umgebaute Header-Suche öffenbar. Neue JSON-Route
`GET /api/tickets/search`. Siehe DECISIONS „Slice 5".
**Fertig wenn:** Palette öffnet per Shortcut/Header, Navigation + Ticketsuche
funktionieren, im Browser belegt. ✓

### B22 — Seite „Meine Zeiten" (read) — ERLEDIGT (2026-06-04)
**Abhängigkeit:** V3 (TimeEntries read)
**Umgesetzt:** `/zeiten` – eigene Zeiteinträge Heute/Diese Woche (Umschalter),
Summen (Gesamt/Abrechenbar/Nicht abrechenbar), Liste mit Ticket-Link. Nav-Punkt in
Sidebar + Palette. Rein lesend. Siehe DECISIONS „Slice 6".
**Fertig wenn:** Seite zeigt eigene Zeiten korrekt summiert, Umschalter + Links
funktionieren, im Browser belegt. ✓

### B23 — Playwright-Smoke-Suite — ERLEDIGT (2026-06-04)
**Abhängigkeit:** B07–B22 (Kernpfade stehen)
**Umgesetzt:** `@playwright/test` + `playwright.config.ts` + `e2e/` (auth.setup +
9 Smoke-Tests: Login, Listen, Detail, Suche/Palette, Dialoge, Status-Inline-Edit am
Testticket). Scripts `test:e2e`/`test:e2e:ui`, Doku `e2e/README.md`. 10 grün.
Siehe DECISIONS „Slice 7".
**Fertig wenn:** `npm run test:e2e` läuft grün, Schreibtest nur am Testticket. ✓

### B24 — Konsistenz-Sweep (präsentational) — ERLEDIGT (2026-06-04)
**Abhängigkeit:** —
**Umgesetzt:** Off-Token `text-[10px]`→`text-xs`; Summenkarten /zeiten an Dashboard-
KPI-Stil angeglichen; TicketsList-Empty mit Icon. Hard-Rules geprüft (kein style=/
Emoji). Siehe DECISIONS „Slice 8". **Offen vermerkt:** Tastatur-Navigation der
klickbaren Tabellenzeilen (Logik, später).
**Fertig wenn:** Empty/Loading/Error + Tokens konsistent, keine Logik berührt. ✓

### B25 — Doku auf Stand — ERLEDIGT (2026-06-04)
**Umgesetzt:** Root-`README.md` neu (Zweck/Stack/Setup/Befehle/Auth/Funktionsumfang),
neu `docs/ARCHITECTURE.md` (Repo-Karte), `docs/README.md` entstaubt. DECISIONS/BACKLOG
je Slice gepflegt. Siehe DECISIONS „Slice 9".
**Fertig wenn:** README + Architektur aktuell, DECISIONS/BACKLOG auf Stand. ✓

---

## Folge-Lauf 2026-06-04 — Teil A (Follow-ups) + Kundenakte (Firmen & Kontakte)

### A1 — Neues Ticket: Standard-Queue „Level I-Support" — ERLEDIGT (2026-06-04)
Zentrale Konstante `NEW_TICKET_DEFAULT_QUEUE` (29682833), im Dialog vorbelegt; Guard
unverändert. Verifiziert gegen `.env.local` + Browser. Siehe DECISIONS „A1".

### A2 — Playwright: Schreibtest (43180) hinter Env-Flag — ERLEDIGT (2026-06-04)
Status-Inline-Edit am Testticket via `test.skip(E2E_SKIP_WRITE_TESTS)` abschaltbar
(default lokal an). Doku in `e2e/README.md`. Verifiziert: Flag gesetzt → 1 skipped,
ohne Flag → 2 passed. Siehe DECISIONS „A2".

### A3 — Anhänge (GATED) — ERLEDIGT (2026-06-04)
Gate **positiv**: App-User sieht FILE-Anhänge, Round-Trip an 43180 inhaltsgleich.
Liste + Download bestanden bereits; **Upload** neu gebaut (`attachments.upload`,
`POST /api/tickets/[id]/attachments` mit 10-MB-Limit, `AttachmentUpload`-UI). UI +
API-Gegenprobe (id 33663, MATCH true). Hinweis: API kann Anhänge nicht löschen (405).
Siehe DECISIONS „A3".

### B1 — Sidebar: Nav „Firmen" + „Kontakte" — ERLEDIGT (2026-06-04)
Zwei Nav-Punkte (Building2Icon/ContactIcon) nach Teamtickets; Aktiv-Zustand über
isActiveRoute. Verifiziert Hell/Dunkel/Mobile. Siehe DECISIONS „B1".

### B2 — /companies (Firmenliste) — ERLEDIGT (2026-06-04)
Aktive Firmen gebündelt (Cap 1000 statt ~500 – deckt die 637 ab; 60 s Cache); Spalten
Name/Ort/Telefon/offene Tickets (EIN gebündelter Open-Ticket-Abruf, clientseitig nach
companyID gruppiert; Cross-Check vs. Count-Endpoint MATCH); Tippen-Filter +
clientseitige Sortierung; Zeile → Kundenakte. Siehe DECISIONS „B2".

### B3 — /companies/[id] (Kundenakte) — ERLEDIGT (2026-06-04)
Kopf (Name/Adresse/Telefon/Web) + „Neues Ticket für diese Firma" (Dialog vorbefüllt,
Kontakte gefiltert); URL-gesteuerte Tabs [Offene][Abgeschlossene][Kontakte][Geräte]
[Verträge]; Tickets über gemeinsame TicketsList (Firma-Spalte aus). Verifiziert an Beispielfirma
(222, alle Tabs) + Empty-State (5GAA 309 Geräte). Siehe DECISIONS „B3".

### B4 — /contacts + /contacts/[id] — ERLEDIGT (2026-06-04)
Kontaktliste (Name/Firma/E-Mail/Telefon, erste Seite + debounced server-contains-Suche
Vor-/Nachname, clientseitige Sortierung); Detail mit Firmenlink + offenen/abgeschlossenen
Tickets (contactID, UrlTabs + TicketsList). Verifiziert: Suche „Demo" → 9 Treffer;
Beispielkontakt (30682924) zeigt T20220517.0009. Siehe DECISIONS „B4".

### C1 — Schnellsuche gruppiert — ERLEDIGT (2026-06-04)
Command-Palette: drei parallele, je 5er-limitierte, debounced Abfragen → Sektionen
Tickets/Firmen/Kontakte; Navigation je Typ. Verifiziert „Demo"/„Beispielfirma". Siehe
DECISIONS „C1".

### C2 — /search Ergebnisseite — ERLEDIGT (2026-06-04)
Scope-Tabs [Tickets][Firmen][Kontakte] (UrlTabs param=scope, q bleibt erhalten) mit
vollen Listen je Scope (searchTickets / companies.searchRows / getContactsList), Klick
navigiert je Typ. Verifiziert „Demo" (Kontakte volle 9 inkl. Demo Agent) + „Beispielfirma"
(Firmen). Siehe DECISIONS „C2".

## Folge-Feedback Paul 2026-06-04 (Tabellen/Suche/Filter)

### BULK — Mehrfachauswahl + Bulk-Aktionen in den Ticketlisten — ERLEDIGT (2026-06-04)
Checkbox-Auswahl pro Seite in der gemeinsamen TicketsList (`selectable`, AN in
Meine/Team/Kundenakte-/Kontakt-Ticket-Tabs). Bulk-Leiste **ersetzt** die Filterzeile
(kein Einschieben → Tabelle rutscht nicht; Paul-Feedback): Status/Priorität/Queue
ändern, Zuweisen + „Mir zuweisen" (gekoppelte Rolle wie B15b), Auswahl aufheben.
Ausführung über das bestehende `PATCH /api/tickets/[id]` (kein neuer Schreibpfad),
Limiter max. 3 parallel, Fortschritt, Teilfehler-Zusammenfassung. Verifiziert NUR an
ZZZ-Testtickets 43180–43183 (Status hin/zurück, Mir-zuweisen hin/zurück, Kopf-Checkbox,
Auswahl leert). Build + e2e 10/10 grün; Hell/Dunkel/Mobile. Siehe DECISIONS „BULK".

### FB1 — Firmenliste: Kundenart-Filter (Default „Kunde") + Spalte — ERLEDIGT (2026-06-04)
Kundenart-Select (Default „Kunde", aktiv) + sortierbare Spalte „Kundenart"
(companyType). Verifiziert: Kunde = 99/637, Alle = 637. Siehe DECISIONS „FB1".

### FB2 — Kontaktliste: Filter nach Firma — ERLEDIGT (2026-06-04)
Firma-Combobox (async, „Alle Firmen") auf /contacts; lädt server-seitig alle Kontakte
der Firma, kombinierbar mit Namenssuche. Verifiziert Beispielfirma → 92 Kontakte. Siehe
DECISIONS „FB2".

### FB3 — Suche in jeder Ticketansicht — ERLEDIGT (2026-06-04)
TicketsList-Suchfeld (Nummer/Titel) + searchMode (server/client/off); server-seitige
Suche via ticketSearchFilter in Meine/Team/Kundenakte-/Kontakt-Ticketlisten, client in
den Dashboard-Drilldowns. Verifiziert my „Jahresgespräch" + Kundenakte „Firewall" (Tab
bleibt). Siehe DECISIONS „FB3".

### FB7 — Kundenakte-Kopf final: Kopfzeile + 5 KPI-Kacheln — ERLEDIGT (2026-06-04)
Zwei Kopf-Karten (FB6) entfernt. Stammdaten als ruhige Kopfzeile (ohne Box) unter der
h1; Kennzahlen als 5 klickbare KPI-Kacheln (Dashboard-Muster) über die volle Breite.
Daten aus getCompanyStats. Verifiziert Beispielfirma 222. Siehe DECISIONS „FB7".

### FB6 — Kundenakte-Kopf: zwei Karten (Stammdaten + Kennzahlen) — ERSETZT durch FB7
War: Stammdaten + Überblick-Karte nebeneinander. Auf Paul-Wunsch durch FB7 ersetzt
(wirkte halbleer). getCompanyStats bleibt.

### FB5 — Suche in JEDER Liste + smartere Spaltenbreiten — ERLEDIGT (2026-06-04)
Wiederverwendbare SearchableTable; Suche in Kundenakte-Tabs (Kontakte/Geräte/Verträge)
+ „Meine Zeiten". Tabellen auf automatisches Layout (inhaltsbasierte Breiten, umbrechend,
min-w) statt table-fixed → kein Desktop-Scrollbalken, smarter. Siehe DECISIONS „FB5".

### FB4 — Alle Tabellen perfektionieren + voll responsive — ERLEDIGT (2026-06-04)
Einheitliches Muster (overflow-x-auto + min-w + umbrechende Textzellen + feste
schmale Spalten) für TicketsList/Firmen/Kontakte/Kundenakte-Tabs/Meine Zeiten; Filter-
leisten flex-wrap, Suchfeld mobil volle Breite. Verifiziert Mobile. Siehe DECISIONS „FB4".

---

### Wenn du unsicher bist
Bei einem Befund, der den Plan umwirft, oder bei fehlenden Zugangsdaten/Werten:
**stoppen, in DECISIONS.md notieren, Paul fragen.** Nicht eigenmächtig eine andere
Architektur wählen.
