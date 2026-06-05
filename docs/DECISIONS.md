# DECISIONS.md – Verifizierte Fakten & Entscheidungen

> Schnellüberblick/Stand zuerst in **[`STATE.md`](STATE.md)**. Diese Datei ist das
> chronologische Detailgedächtnis (verifizierte Fakten + Begründungen).

Dieses Dokument ist das **Gedächtnis** des Projekts über Sessions hinweg.

Regeln:
- Hier stehen nur **verifizierte** Fakten (durch echte API-Aufrufe belegt) und
  bewusst getroffene **Architekturentscheidungen**.
- Bei Konflikt zwischen Blueprint-Annahme und einem Eintrag hier gewinnt **dieser
  Eintrag**.
- Jeder Eintrag bekommt ein Datum. Nichts löschen – bei Korrektur einen neuen
  Eintrag mit "ersetzt Eintrag vom …".

---

## Teil A – API-Befunde aus Phase 0

> Wird von Claude Code während B00 ausgefüllt. Solange hier `OFFEN` steht, ist der
> jeweilige Punkt nicht verifiziert und es darf keine darauf aufbauende Logik
> gebaut werden.

> Verifikation durchgeführt am **2026-06-01** mit echten Calls gegen
> `https://webservices18.autotask.net/ATServicesRest/V1.0` (Zone DE1, ci 632538),
> API-User `dmwfvluhs2biwhn@…` (Resource-ID **29682940**). Skript:
> `scripts/verify-api.mjs` (Aufruf `node --env-file=.env.local …`).

### ⚠️ MANDANTEN-WARNUNG: App-Tenant ≠ Autotask-MCP-Tenant (2026-06-03)
- Die **App** (`.env.local`-Creds, BFF-Client) und das in Claude verfügbare
  **Autotask-MCP-Tool** sprechen **unterschiedliche Autotask-Mandanten** an –
  zwar dieselbe **Zone** (`webservices18`), aber **andere Daten**.
- Beleg: Für **dieselbe** `resourceID 29682886` + `status≠5` liefert der
  **MCP** `27` offene Tickets, die **App** `51` (in der App dreifach konsistent:
  KPI = Chart-Balken Demo Teamlead = 51). Gleiche ID, gleiche Methode, andere Zahl ⇒
  zwei verschiedene Tenants.
- **Konsequenz:** Zahlen/Counts aus MCP und App **NICHT vergleichen oder
  vermischen.** Die früheren „B15-Vorab"-Counts (27/2/1/1) stammen vom
  **MCP-Tenant** – die **Methode** ist gültig, die konkreten Zahlen gehören
  NICHT zum App-Backend. Die echten App-Zahlen (Demo Teamlead) sind **51/49/4/0**.

### REGEL: API-Verifikation immer gegen `.env.local` / App-Client
- **Alle** künftigen API-Verifikationen (Felder, Picklists, Counts, Schreibtests)
  laufen gegen die **App-eigenen `.env.local`-Creds** bzw. den **App-Client**
  (`lib/autotask/client.ts`) – z. B. über `scripts/verify-api.mjs`
  (`node --env-file=.env.local …`) oder eine temporäre, **dev-only und nicht
  committete** Verifikations-Route.
- Das **Autotask-MCP-Tool** ist dafür **nicht** zu verwenden (anderer Mandant,
  s. o.). MCP höchstens für mandanten-unabhängige API-*Verhaltens*-Fragen
  (Operatoren, Feldnamen), nie für Daten/Counts des Produkts.

### Allgemeine API-Fakten (gelten für alle Entitäten)
- **Auth:** drei HTTP-Header `ApiIntegrationCode`, `UserName`, `Secret`. Belegt
  durch HTTP 200 auf `GET Tickets/entityInformation`.
- **Secret-Falle:** Das Secret enthält `$ ~ * # @`. In `.env.local` MUSS es in
  **einfache Anführungszeichen** (`AUTOTASK_API_SECRET='…'`). Sonst schneidet der
  env-Parser ab dem `#` ab (Inline-Kommentar) → verstümmeltes Secret → 401.
  Verifiziert: unquoted kam Länge 9 statt 25 in `process.env` an.
- **Query:** `POST {Entity}/query` mit Body `{ "MaxRecords": n, "IncludeFields":
  [...], "Filter": [ { "op": "...", "field": "...", "value": ... } ] }`.
  Verifizierte Ops: `gte`, `gt`, `eq`, `noteq`, `lt`, `lte`, `contains`,
  `beginsWith`, **`in`** (Wert = Array, z. B. `{op:"in",field:"id",value:[0,222]}`,
  2026-06-02), **`notExist`**/`exist` (Null-Check ohne `value`, 2026-06-03 – Gotcha:
  `noteExist` wird still ignoriert), **`or`/`and`-Gruppen** (`{op:"or",items:[…]}`,
  2026-06-03). → Batch-Auflösung via `in` (kein N+1) und Mehrfeld-Suche in EINER
  Query via OR-Gruppe.
- **Paging:** Antwort liefert `pageDetails.nextPageUrl` / `prevPageUrl`. Folgeseite
  = **POST** auf diese URL **mit erneutem Filter-Body** (2026-06-02 verifiziert:
  GET → **405**, fehlender Body → **500** „Parameter name: filters"). Der Paging-Token
  trägt nur die Position (previousIds/nextIds/pageSize), **nicht** den Filter →
  Filter muss je Seite neu gesendet werden. **Sicherheits-Konsequenz:** „Meine
  Tickets" bleibt server-seitig erzwungen, weil der Server den `assignedResourceID`-
  Filter bei jeder Seite neu setzt (Client liefert nur den opaken Cursor; SSRF-Schutz:
  Cursor muss eigene Zone + `Tickets/query/(next|previous)` sein).
- **Child-Entitäten anlegen:** über den **Eltern-Pfad**, nicht die Top-Level-URL.
  TicketNotes z. B. via `POST Tickets/{ticketID}/Notes` — `POST TicketNotes`
  liefert **404**. Lesen geht weiterhin über `POST TicketNotes/query`.
- **Feld-/Picklist-Metadaten:** `GET {Entity}/entityInformation/fields` liefert je
  Feld `dataType`, `isRequired`, `isReadOnly`, `isReference`/`referenceEntityType`,
  `isPickList` + `picklistValues`. **Diese Registry ist die Quelle der Wahrheit
  für die UI-Mappings** (nicht hartkodieren — siehe Architekturentscheidung).

### V1 – TicketNotes: noteType / publish / E-Mail-Verhalten
- Status: **VERIFIZIERT (2026-06-01)**
- Pflichtfelder beim Anlegen: `ticketID` (→Ticket), `description` (max 32000),
  `noteType`, `publish`. Optional u. a. `title`, `createdByContactID`.
  `createDateTime`, `creatorResourceID` sind read-only.
- Verfügbare `noteType`-Werte (aktiv): `1`=Zusammenfassung der Aufgabe,
  `2`=Aufgabendetails, `3`=Aufgabennotizen, `13`=Notiz für Workflow-Regel,
  `15`=Notiz für Ticketduplikat, `16`=Notiz für Outsourcing-Workflow, `17`=Umfragen,
  `18`=Kundenportal-Notiz, `19`=Taskfire-Notiz, `91`=Workflow-Regel - Aktionsnotiz,
  `92`=Notiz weiterleiten/ändern, `93`=In Ticket zusammengelegt, `94`=Anderes
  Ticket aufgenommen, `95`=In Projekt kopiert, `99`=RMM-Notiz, `100`=BDR-Notiz,
  `101`=Email Note.
- Verfügbare `publish`-/Sichtbarkeits-Werte: `1`=All Autotask Users,
  `2`=Internal Project Team, `4`=Internal & Co-Managed. **Alle drei sind interne
  Sichtbarkeitsstufen** — keiner adressiert den Kunden. Das `TicketNotes`-Entity
  hat **kein** `notify`/Empfänger-Feld.
- Kombination, die eine E-Mail auslöst: **KEINE.** Test: zwei Notes angelegt
  (noteType 1/publish 1 und noteType 18/publish 1) an Ticket 43180 →
  `NotificationHistory` (Filter `ticketID=43180`) blieb **leer**. Eine API-Note
  verschickt aus sich heraus keine Kunden-Mail.
- Kombination "nur intern": faktisch **alle** (publish steuert nur interne
  Sichtbarkeit).
- E-Mail-Versand abhängig von Autotask-Workflow? **JA.** Beleg: am selben Ticket
  feuerte eine **Workflow-Regel** („Teams Nachricht für neue Tickets", Bedingung
  Status=Neu) automatisch und erzeugte eine Notiz `noteType=13`. Heißt:
  Benachrichtigungen (Teams/Mail) laufen über **Autotask-Workflow-Regeln**, nicht
  über Note-Felder. Eine Kunden-Mail beim Notieren erfordert eine separat
  konfigurierte Workflow-Regel (Autotask-Konfiguration, **kein Code-Problem**).

### V2 – Eingehende E-Mails -> TicketNotes
- Status: **TEILVERIFIZIERT — in Sandbox nicht aktiv belegbar (2026-06-01)**
- Inbound in Sandbox belegbar? **Nein** — kein Weg, eine echte eingehende Mail in
  die Sandbox einzuspeisen (kein erreichbares konfiguriertes Postfach). Nicht als
  Blocker gewertet (war im Blueprint ohnehin als Polling geplant).
- Indiz / resultierender noteType: Die `noteType`-Picklist enthält `101`=**Email
  Note** → eingehende Mails erscheinen als TicketNote dieses Typs. Inbound läuft in
  Produktion über die Autotask-Mailprozesse („Add Ticket Email Service").
- Konsequenz für UI: **Polling der TicketNotes**, kein Echtzeit-Versprechen.
  Empfehlung 30–60 s Intervall. Optionales Near-Realtime via Webhook (siehe V4).

### V3 – TimeEntries
- Status: **VERIFIZIERT (2026-06-01)**
- Lesen: **JA** (`POST TimeEntries/query`).
- Anlegen (POST): **JA** (`POST TimeEntries`). Beleg: TimeEntry `id 30548`.
  Bedingungen: `resourceID` ist Pflicht; für **Ticket-Zeiten ist `roleID`
  Pflicht** (Fehler „TimeEntries for Tickets must have a roleID."), und die
  `roleID` muss eine Rolle sein, die die Resource **tatsächlich hält** (sonst
  Fehler „There is no row at position 0." — Rollen je Resource via
  `ResourceRoles/query`).
- Post/Approve per API: **NEIN** dedizierter Endpoint. `entityInformation`:
  canCreate/canUpdate/canDelete = true (Zugriff „Restricted"), aber Genehmigen/
  Posten läuft über Autotasks Billing-Approval-Prozess (UI/Workflow), nicht als
  einfacher REST-Call.
- Relevante Felder: `resourceID`(REQ,→Resource), `ticketID`(→Ticket),
  `roleID`(→Role), `dateWorked`, `startDateTime`, `endDateTime`, `hoursWorked`,
  `hoursToBill`(RO), `summaryNotes`, `internalNotes`,
  `isInternalNotesVisibleToComanaged`, `isNonBillable`, `billingCodeID`,
  `contractID`, `showOnInvoice`, `billingApproval*`.
- Entscheidung MVP: Zeiterfassung **read + create** (nach Verifikation der
  konkreten Felder); **Approve/Post NICHT im MVP** (bleibt Autotask-UI).

### V4 – Webhooks
- Status: **VERIFIZIERT (2026-06-01)**
- Ticket-Webhooks verfügbar? **JA** — Entity `TicketWebhook`, volle CRUD
  (canCreate/canQuery/canUpdate/canDelete = true).
- TicketNote-Webhooks verfügbar? **JA** — Entity `TicketNoteWebhook`, volle CRUD.
- Payload-Struktur: **nicht getestet** — erfordert einen öffentlich erreichbaren
  Endpunkt (z. B. Request-Bin), in Phase 0 bewusst nicht eingerichtet. Capability
  ist bestätigt; Payload-Test auf später verschoben.
- Konsequenz: Chat bleibt im **MVP Polling-basiert**; Near-Realtime via
  `TicketNoteWebhook` ist später möglich (kein Blocker).

### V5 – Tickets: Felder, Picklists, Filter
- Status: **VERIFIZIERT (2026-06-01)**
- Status-Picklist: `1`=Neu, `5`=Abgeschlossen, `7`=Warten auf Kundenreaktion,
  `8`=In Bearbeitung, `9`=Warten auf Materialien, `10`=Servicetermin geplant,
  `11`=Eskaliert, `12`=Warten auf Lieferanten, `13`=Warten auf Genehmigung,
  `14`=Gelöst warten auf Kunden, `15`=Kundennotiz hinzugefügt, `16`=RMM Warnung
  geschlossen, `17`=Warten Kundenunterschrift, `18`=Fälligkeit überschritten,
  `19`=Spätere Fälligkeit, `20`=Warten auf ext. Support, `21`=Reklamation.
- Priority-Picklist: `1`=Hoch, `2`=Mittel, `3`=Niedrig, `4`=Kritisch.
- Queue-Picklist: `5`=Kundenportal, `6`=Transfer vom Vertrieb,
  `8`=Überwachungswarnung, `29682833`=Level I-Support, `29682969`=Level II-Support,
  `29683354`=Ticketserien, `29683359`=Sales.
- `source`: `-1`=Kundenportal, `1`=Sonstige, `2`=Telefon, `4`=E-Mail,
  `6`=Persönlich/vor Ort, `8`=Überwachungswarnung, `11`=Vertrag, `12`=Teams,
  `13`=ESETProtect, `14`=Netzwerkanalyse, `15`=Microsoft Defender.
- Feldname Fälligkeit / completed / lastActivity: **`dueDateTime`** /
  **`completedDate`** (+`completedByResourceID` RO) / **`lastActivityDate`**.
  „Meine Tickets" = **`assignedResourceID`**. „Teamtickets" = **`queueID`**
  (Achtung: **kein `departmentID`** auf Ticket-Ebene). Weitere: `createDate`,
  `contactID`, `companyID` (REQ), `priority`/`status` (REQ), `queueID`,
  `lastCustomerVisibleActivityDateTime`, `lastCustomerNotificationDateTime`.
- SLA-Felder (verifiziert): `serviceLevelAgreementID` (PICK: `1`=Standard SLA,
  `3`=Standard SLA SSIG-IT GmbH), `serviceLevelAgreementHasBeenMet`(RO),
  `firstResponseDueDateTime`/`firstResponseDateTime`(RO),
  `resolutionPlanDueDateTime`/`resolutionPlanDateTime`(RO),
  `resolvedDueDateTime`/`resolvedDateTime`(RO),
  `serviceLevelAgreementPausedNextEventHours`(RO).
- Filter-/Paging-Format bestätigt? **JA** (echter gefilterter + gepagter Aufruf,
  siehe „Allgemeine API-Fakten" oben).

### V6 – Resource-Mapping & Rate-Limit
- Status: **VERIFIZIERT (2026-06-01)**
- Mapping Mail/UPN -> resourceID: über `Resources/query` (Filter auf `email` oder
  `userName`). Sandbox-Resources (Auszug): `4`=administrator (full),
  `29682886`=Demo Teamlead / `demo.lead` (full, L1-Support, Mail
  `teamlead@example.com`), `29682903`=Demo Agent,
  `29682904`=Karlheinz …, API-Integrationsuser = **`29682940`** (taucht als
  `creatorResourceID` unserer Schreibvorgänge auf). **Hinweis:** viele Resources
  teilen die Sandbox-Sammel-Mail `qalab@autotask.com` → Mapping besser über
  `userName` (eindeutig) als über `email`. Das speist später den
  Mock-User-Umschalter und `autotaskResourceId` im `SessionUser`.
- Rate-Limit-Verhalten beobachtet: Autotask sendet **keine** Rate-Limit-Header in
  den Antworten (kein `X-RateLimit-*`). Kein `429` provoziert (bewusst nicht). Die
  Doku-Werte (≈10k/60min je Tenant, 3 Threads/Tabelle) bleiben Planungsgrundlage —
  der Client muss **blind** drosseln (eigener Concurrency-Limiter + 429-Backoff),
  da kein Header-Feedback kommt.

### Testdaten-Hinweis
Phase-0-Testobjekte (sauber als `ZZZ TEST` markiert, Firma SSIG-IT GmbH Sandbox /
Kontakt Paul-Harald Katio): Ticket `43180`, TicketNotes `29926287`/`29926288`,
TimeEntry `30548`. Keine dieser Aktionen hat eine Mail ausgelöst.

---

## Teil B – Architekturentscheidungen

> Format: **[Datum] Titel** — Entscheidung — Begründung — Auswirkung.

### [vor Projektstart] Stack festgelegt
- Entscheidung: Next.js (App Router) + TS + Tailwind v4 + shadcn/ui; Charts über
  shadcn-`Chart` (Recharts). **Kein `@tremor/react`.**
- Begründung: Das alte `@tremor/react`-Paket-Modell ist eingestellt; Tremor wurde
  von Vercel übernommen und ist im Copy-Paste-/Radix-Modell aufgegangen, das
  shadcn/ui ohnehin nutzt. Ein Stack statt zwei -> kein Tailwind-Config-Konflikt,
  eine Skill, konsistentes Theming inkl. Dark Mode über semantische Tokens.
- Auswirkung: Alle Dashboard-Visualisierungen mit shadcn-`Chart`.

### [vor Projektstart] Auth: Mock zuerst, Entra ID gekapselt
- Entscheidung: Auth über Provider-Interface (`lib/auth/`). Phase 1 Mock-Provider,
  Entra ID später als zweiter Provider mit identischer `SessionUser`-Form.
  Umschaltung per `AUTH_MODE`.
- Begründung: Entra-Integration ist der fehleranfälligste Teil; sie darf die
  lokale Entwicklung nicht von Tag eins blockieren.
- Auswirkung: Server-Code liest nur `SessionUser`, nie "den Login" direkt.

### [vor Projektstart] BFF + Schreibsperre
- Entscheidung: Browser spricht nur mit internen Routen; Autotask-Creds server-only;
  Concurrency-Limiter (max 3/Tabelle); Schreibpfade erst nach Phase-0-Verifikation.
- Begründung: Sicherheit + Autotask-Thread-Limit + keine Blindflug-Schreibvorgänge.

### [2026-06-01] Sandbox-Testdaten-Regel
- Entscheidung: Test-Schreibvorgänge ausschließlich an Firma **„SSIG-IT GmbH
  Sandbox"** (`companyID = 0`) mit Kontakt **„Paul-Harald Katio"**
  (`contactID = 30684646`, Mail `qalab@autotask.com` = Sandbox-Catch-all).
- Begründung: Die Sandbox enthält echte Kontakte mit potenziell echten Mail-
  Adressen; ein Test an fremdem Kontakt kann eine echte Mail auslösen.
- Auswirkung: Gilt für jeden POST/PATCH gegen Tickets/TicketNotes/TimeEntries.
  Steht auch in `CLAUDE.md` §5.

### [2026-06-01] Erweiterbarkeit + KI-Navigierbarkeit als Architekturprinzip
- Entscheidung: Code und Repo werden von Anfang an so gebaut, dass (a) neue
  Autotask-Entitäten/Funktionen **additiv** dazukommen ohne Kernumbau, und (b)
  eine KI mit **minimalem Token-Aufwand** das Richtige findet. Konkrete Weichen:
  1. **Generischer Autotask-Client-Kern** (`query`/`get`/`create`/`update` +
     Paging + Concurrency-Limiter + 429-Backoff) plus **dünne, entitätsspezifische
     Wrapper** unter `lib/autotask/entities/<entity>.ts`. Neue Entität = eine neue
     kleine Datei, kein Eingriff in den Kern.
  2. **Feld-/Picklist-Registry** aus `entityInformation/fields` (gecacht), zentral —
     UI-Mappings (Status/Priority/Queue-Labels) werden **nicht** über den Code
     verstreut hartkodiert.
  3. **Feature-Slices:** jede UI-Funktion (`dashboard`, `tickets`,
     `ticket-detail`, `chat`) als in sich geschlossener Ordner; lokales
     Mini-README erklärt Zweck + Grenzen des Slice.
  4. **Discovery billig:** ein knappes `docs/ARCHITECTURE.md` als Karte des Repos +
     konsistente Namens-/Ordnerkonventionen + kurze Kopf-Kommentare („was ist das,
     was gehört NICHT hierher"), damit eine KI nicht das ganze Repo lesen muss.
  5. **Schreibpfade hinter einer schmalen, geprüften Schicht** (Allowlist je Feld),
     damit neue Schreibfähigkeiten kontrolliert und nachvollziehbar wachsen.
- Begründung: Autotask hat quasi unendlich viele Entitäten; das MVP deckt wenige
  ab, aber jede spätere Erweiterung muss billig sein — sowohl im Code als auch im
  Token-Budget der KI, die daran weiterarbeitet.
- Auswirkung: bindend für alle Bauphasen ab B01. Bei jeder neuen Funktion zuerst
  prüfen, ob sie als additiver Slice + Wrapper passt; wenn nicht, Entscheidung hier
  dokumentieren.

### [2026-06-01] Chat-Sidebar: Senden = TicketNote + noteType-Schalter
- Entscheidung:
  - **Senden in der Chatleiste = Notiz anlegen** via `POST Tickets/{id}/Notes`
    (nicht `/TicketNotes` → 404).
  - **UI-Schalter „Kunde benachrichtigen":** AN = Notiz mit dem **kundenseitigen
    `noteType`**, AUS = **interner `noteType`**. Der Schalter steuert also den
    `noteType`, **kein** API-Feld (die REST-API hat kein „notify"-Feld — siehe V1).
  - Die eigentliche **Kunden-Mail liefert eine Autotask-Workflow-Regel**
    (manueller Konfigurationsschritt in Autotask, **vor B11** einzurichten).
  - **Provisorische noteType-Wahl (final erst vor B11):** kundenseitig = **`18`
    (Kundenportal-Notiz)**, intern = **`2` (Aufgabendetails)**, jeweils `publish=1`.
  - **Tabu als Chat-noteType:** `101` (Email Note — reserviert für Inbound, V2),
    `13`/`91` (werden von Workflow-Regeln automatisch erzeugt).
- Begründung: Das UI-Häkchen „Ticketansprechpartner benachrichtigen" existiert in
  der REST-API nicht; Benachrichtigung läuft ausschließlich über Workflow-Regeln
  (offiziell bestätigt). Über den `noteType` als Diskriminator wird der gewünschte
  Häkchen-Effekt reproduziert.
- **Offener Punkt (bei Bau der Regel zu prüfen):** Kann die Workflow-Regel nach
  `noteType` gefiltert werden? Falls **nein**, brauchen wir einen anderen
  Diskriminator (z. B. `publish`-Wert oder ein Schlüsselwort/Marker). **Blockiert
  B01 nicht.** Finaler `noteType` wird erst vor B11 festgelegt.
- Auswirkung: betrifft B10/B11. Bis zur Festlegung kein produktiver Sende-Pfad.

### [2026-06-01] Resource-Mapping über userName (Mock-Provider B04)
- Entscheidung: Das Mapping User → Autotask-Resource erfolgt über **`userName`**,
  nicht über `email`. Der Mock-Provider (B04) nutzt `userName` als Mapping-Schlüssel
  und füllt damit `autotaskResourceId` im `SessionUser`.
- Begründung: In der Sandbox teilen sich viele Resources die Sammel-Mail
  `qalab@autotask.com` → `email` ist nicht eindeutig; `userName` ist eindeutig.
- Auswirkung: B04 Mock-Provider; in B16 (Entra) wird stattdessen das echte
  Entra-Mapping (oid/upn → Resource) verwendet.

### [2026-06-01] B01 Bootstrap — Stack-Versionen & components.json
- Next.js **16.2.7** (App Router, Turbopack), React **19.2.4**, TypeScript 5,
  Tailwind **v4**, Paketmanager **npm**. Kein `src/`-Verzeichnis; Import-Alias `@/*`.
- `components.json`: `style` = **base-nova**, `tailwind.baseColor` = **neutral**,
  `tailwind.cssVariables` = true, `tailwind.css` = `app/globals.css`,
  `iconLibrary` = **lucide**, `rsc` = true, `tsx` = true. Aliases: components
  `@/components`, ui `@/components/ui`, lib `@/lib`, utils `@/lib/utils`, hooks
  `@/hooks`. (tailwindVersion wird in v4 nicht mehr als eigenes Feld geführt — über
  `tailwindcss ^4` in `package.json` belegt.)
- Hinweis: shadcn 4.x baut auf `@base-ui/react` (nicht mehr direkt auf Radix).

### [2026-06-01] Sicherheitsnotiz — Sandbox-API-Secret noch zu rotieren
- Stand: Das Sandbox-API-Secret wurde bisher nur **gequotet** (Single-Quotes in
  `.env.local`, damit `# $` nicht verstümmeln), aber **nicht rotiert**. Es lag
  zwischenzeitlich im Klartext in der versionierten `.env.example` (inzwischen auf
  Platzhalter zurückgesetzt, Datei war aber committet).
- **Offene Aktion (keine sofortige nötig):** Secret **rotieren**, am besten beim
  Einrichten der Workflow-Regel **vor B11** (gleicher Gang in die Autotask-UI).
  Danach neues Secret single-quoted in `.env.local` eintragen.
- Auswirkung: rein betrieblich; kein Code betroffen.

### [2026-06-01] B04 Mock-User & Rollen-Zuordnung
- Mock-Provider liest die Auswahl aus Cookie `mock_user` (Wert = `userName`) und
  mappt über `userName` (nicht E-Mail) auf eine echte Sandbox-Resource.
- Festgelegte Mock-User (Rollen für Mock-Phase frei gewählt, je eine Rolle vertreten):

  | userName | Name | resourceID | Rollen |
  |---|---|---|---|
  | `demo.agent` | Demo Agent | 29682903 | `agent` |
  | `demo.lead` | Demo Teamlead | 29682886 | `agent`, `teamleiter` |
  | `administrator` | Autotask Administrator | 4 | `admin` |

  (E-Mail von `administrator` ist in der Sandbox leer → Mock-Platzhalter
  `admin@example.com`.)
- **UI-Rollen-Gating AUFGESCHOBEN, nicht entfernt (Entscheidung Paul, 2026-06-01):**
  Aktuell sehen alle Nutzer dieselbe Ansicht – jeder Nav-Link (inkl. Teamtickets,
  Admin) ist für alle sichtbar. Ob aktives Gating eingeführt wird, wird **bei B12
  (Teamtickets)** entschieden. Bis dahin: kein Gating in der UI.
- Das Feld `SessionUser.roles` **bleibt als Weiche erhalten** (CLAUDE.md §4, Entra-ID
  füllt es später; Datenmodell ist gating-fähig) – die UI verzweigt aktuell aber
  **nicht** danach, und Rollen werden in der UI nicht angezeigt.
- Geschützte Routen (`app/(app)/*`) lesen serverseitig `getSession()`; ohne Session
  → redirect `/login`. Login im Mock-Modus = shadcn Card mit User-Auswahl. Der
  Mock-Switcher dient nur dazu, als anderer Kollege zu agieren („Meine Tickets" je
  `autotaskResourceId`), nicht der Rechtetrennung.
- Quelle der UI: Login = shadcn `Card` + `Button`; Switcher = shadcn `DropdownMenu`
  + `Button` (Komponenten-Beschaffungsregel).

### [2026-06-01] B05 Autotask-Client (server-only)
- Struktur (Erweiterbarkeitsprinzip): generischer Kern `lib/autotask/client.ts`
  (`query`/`get`/`create`/`update`) + reine, isoliert testbare Bausteine
  `limiter.ts` (Concurrency) und `backoff.ts` (429-Retry) + `types.ts` (V5-Felder)
  + dünne Entity-Wrapper `lib/autotask/entities/<entity>.ts`. Erste: `tickets.ts`
  (`query`/`get`). Neue Entität = neue kleine Datei, kein Kern-Eingriff.
- Sicherheit: Kern und Wrapper importieren `server-only`; Creds nur aus
  `process.env`, nie geloggt/zurückgegeben. Verifiziert: Secret taucht in **keinem**
  `.next`-Bundle auf (Client und Server), da zur Laufzeit gelesen.
- Verhalten (verifiziert via temporärer Route gegen Sandbox, danach entfernt):
  - Query liefert getypte Tickets (z. B. id 7681); Filter `status eq 1` funktioniert;
    Auto-Paging über `pageDetails.nextPageUrl` (Obergrenze MAX_PAGES=50).
  - Limiter cappt auf **2** gleichzeitige Requests pro Entität (Default; Autotask
    erlaubt 3/Tabelle).
  - 429-Backoff exponentiell (Delays 500→1000→…), `RetryableError` nur bei 429.
- Schreibpfade (`create`/`update`) existieren im Kern, sind aber in B05 **nicht**
  produktiv verdrahtet – Schreiben bleibt hinter der späteren Allowlist-Schicht.

### [2026-06-02] B09 Ticketdetail – Zugriff & Referenz-Auflösung
- **Zugriff:** Jedes Ticket ist per `id` für jeden eingeloggten User lesbar – **kein
  per-Ticket-ACL** im MVP (konsistent mit der aufgeschobenen Rollen-Gating-
  Entscheidung). Route/Page erzwingen nur „eingeloggt"; ohne Session 401 / Redirect.
- **Referenz-Auflösung:** `getTicketDetail()` lädt das Ticket, dann PARALLEL
  (`Promise.all`) Company (in-Query), Contact, ConfigurationItem, assignedResource
  + TicketNotes + TimeEntries. Verschiedene Entitäten → per-Entität-Limiter erlaubt
  Parallelität; **kein N+1** (je ein Call, kein Pro-Zeile-Loop).
- **Verifizierte Felder:** Contact-Opt-Out = `receivesEmailNotifications` (bool);
  ConfigurationItem-Titel = `referenceTitle` (+ `referenceNumber`); Resource-Name =
  `firstName`/`lastName`/`email`. noteType/publish-Labels über eigenen gecachten
  Picklist-Loader (`getNotePicklists`), SLA-Label über `serviceLevelAgreementID`.
- **Sandbox-Beobachtung:** Workflow-Regeln erzeugen beim Ticket-Anlegen automatisch
  TicketNotes (noteType 13) → ein Ticket mit komplett leerer Aktivität ist in der
  Sandbox praktisch nicht reproduzierbar (Empty-Bereich dennoch implementiert).

### [2026-06-02] B10 Chat-Sidebar (lesen) – Konversations-Set & Richtung
- **Konversations-Typ-Set** (eine Konstante `lib/autotask/conversation.ts`,
  PROVISORISCH – endgültig vor B11): `{ outbound: 18 (Kundenportal-Notiz),
  inbound: 101 (Email Note) }`. Nur diese noteTypes erscheinen im Chat; alle
  anderen (z. B. 1, 13) bleiben im Aktivitätslog (B09) und NICHT im Chat.
- **Richtungslogik:** `directionOf()` = inbound, wenn `noteType === 101` ODER
  `createdByContactID` gesetzt (von einem Kontakt erstellt = Kundenseite); sonst
  outbound. createdByContactID/creatorResourceID dient zusätzlich als Sender-Quelle
  (Sender batched über `in`-Query aufgelöst, kein N+1).
- **Endpoint** `GET /api/tickets/[id]/chat` bewusst getrennt von B09 (schlanker
  Payload nur für Konversations-Typen, fürs Polling).
- **Polling:** Intervall 45 s, nur bei sichtbarem Tab (Document Visibility); bei
  verstecktem Tab pausiert (Fetch-Gate + `visibilitychange`-Reload). Verifiziert:
  zweite noteType-18-Notiz erschien nach einem Intervall im DOM.
- **Inbound an echten Daten:** NICHT belegbar – in der Sandbox existiert **kein**
  einziges `noteType=101`-Note (deckt sich mit V2: Inbound nicht einspeisbar). Die
  Inbound-Bubble ist implementiert, aber nur an echten Daten ungeprüft.

### [2026-06-03] B11 Chat senden – Mail-Trigger über UDF (Option A)
- **Befund (isoliert nachgewiesen):** Autotask wertet die Workflow-Regel „Kunde
  benachrichtigen" **asynchron** (~Sekunden) gegen den **aktuellen** UDF-Wert aus,
  NICHT gegen den Wert zum Notiz-Zeitpunkt. Beleg: UDF=Ja → Notiz → **sofortiger**
  Reset auf Nein ⇒ NotificationHistory-Delta **0**; Reset erst nach ~30 s ⇒ Delta **1**.
  Das von der ursprünglichen Spec vorgesehene „Set→Notiz→Sofort-Reset" ist damit
  unmöglich.
- **Gewählt: Option A.** Jeder Send setzt das UDF **vor** der Notiz auf den
  Schalterwert (AN→Ja, AUS→Nein) und setzt es **nie** zurück. Deterministisch für
  app-eigene Sends; pro Ticket serialisiert (Lock).
- **Bekanntes Leck (nur MVP/Sandbox akzeptabel):** Solange das UDF nach einem
  AN-Send auf „Ja" steht, löst eine **nicht-app-eigene** Notiz (Autotask-UI / n8n /
  andere Regel) eine Kundenmail aus. Wird in **B17** vollständig eliminiert.
- Nebenbefund: TicketNote-Create verlangt **`title`** (Pflicht; sonst HTTP 500
  „Missing Required Field: title"). Chat-Notiz leitet den Titel aus der ersten
  Textzeile ab.

### [2026-06-03] B12 Teamtickets – kein Gating, Pool, notExist-Operator
- **Rollen-Gating: weiterhin KEINS** (Entscheidung bei B12 fällig, jetzt bestätigt).
  Teamtickets sind für **alle** eingeloggten User sichtbar; `roles` bleibt im Modell
  als Vorbereitung für Entra (B16). Überschreibt die ursprüngliche BACKLOG-Vorgabe.
- **Wiederverwendung:** B07-Tabelle in gemeinsame Komponente `components/tickets/
  tickets-list.tsx` (TicketsList) gezogen + Daten-Helper `entities/ticket-list.ts`
  (`getTicketsPage`). „Meine Tickets" und „Teamtickets" nutzen beide dieselbe
  Komponente; kein Duplikat.
- **Queue-Default:** keiner – Standard = **alle offenen Tickets aller Queues**
  (status noteq 5), Queue-Select grenzt ein. Begründung: Ohne Team/Queue-Mapping
  ist die breite offene Sicht der nützlichste Default; enthält automatisch auch
  **nicht zugewiesene** Tickets (Pool).
- **Pool / nicht zugewiesen:** Team-Query hat KEINEN assignedResource-Filter →
  unzugewiesene Tickets (`assignedResourceID = null`) sind enthalten, Spalte
  „Zugewiesen" = „—". Zusatzfilter „nur nicht zugewiesene" serverseitig über
  Operator **`notExist`** (Feld ohne `value`). Gegenstück „zugewiesen" = `exist`.
  Beides 2026-06-03 verifiziert (notExist liefert `assignedResourceID:null`, Paging
  intakt). **Gotcha:** Falschschreibung `noteExist` wird von Autotask **still
  ignoriert** (liefert ungefiltert) – nicht „noteExist", sondern `notExist`.

### [2026-06-03] B13 Dashboard – Count-Endpoint, kein Server-Sort, SLA-Definition
- **Count-Endpoint vorhanden:** `POST {Entity}/query/count` → `{ "queryCount": n }`
  (2026-06-03 verifiziert). KPIs zählen darüber statt per Vollabruf. Client:
  `autotask.count(entity, filter)`. KPIs gecacht (revalidate 60 s).
- **Serverseitiges Sortieren: NICHT unterstützt.** `Tickets/query` ignoriert ein
  `sort`-Feld (Ergebnis bleibt id-Reihenfolge, verifiziert). Fallback „Zuletzt
  bearbeitet": eine begrenzte Seite meiner Tickets holen (≤500, kein Auto-Paging),
  nach `lastActivityDate` absteigend sortieren, Top N. Bei >500 eigenen Tickets ist
  das approximativ (dokumentiert).
- **KPI-Definitionen** (assignedResourceID = session, eine Stelle in
  `entities/dashboard.ts`): Offen = `status≠5`; Überfällig = offen + `dueDateTime <
  jetzt`; Heute fällig = offen + `dueDateTime` in [Tagesanfang, Tagesende];
  **SLA-gefährdet (vorläufig, B15)** = offen + `serviceLevelAgreementHasBeenMet =
  false` + `resolvedDueDateTime ≤ jetzt + SLA_RISK_HOURS (4h)`. KPI-Kachel als
  „vorläufig" gekennzeichnet.
- KPI-Klick führt in die vorgefilterte „Meine Tickets"-Liste via `?due=overdue|
  today|sla` (gleiche Filterlogik wie die KPI). Fokuslisten nutzen die gemeinsame
  `TicketsList` (showFilters/showPager=false) – kein neues Grid.

### [2026-06-03] B14 Team-Chart – Balken „Tickets pro Queue"
- shadcn `Chart` (Recharts-basiert, **kein Tremor**), Balkendiagramm. Daten:
  offene Tickets je Queue (status≠5) über den **Count-Endpoint** (ein
  `POST Tickets/query/count` je Queue), bounded auf die ~7 Queues der Picklist,
  60 s gecacht (`getTicketsPerQueue`). Queue-Labels über B06-Mapper.
- Farben/Achsen ausschließlich über Theme-Tokens (`var(--chart-1)` /
  `--color-count`), keine hartverdrahteten Farben → Light + Dark verifiziert.
  Queues mit 0 offenen Tickets erzeugen keinen Balken (Achse zeigt alle 7).
- Kein Rollen-Gating (für alle sichtbar, konsistent mit B12).

### [2026-06-03] B08 Ticketsuche – OR-Gruppe, kein Merge nötig
- Suchfelder: **Ticketnummer** (Muster `T\d…` → `ticketNumber contains`) und
  **Titel** (`title contains`). Zusätzlich **Firma/Kontakt** als Zwei-Schritt:
  Companies (`companyName contains`) bzw. Contacts (`firstName/lastName contains`)
  → IDs → `companyID`/`contactID in […]`.
- **OR-Gruppen-Operator unterstützt** (`{op:"or",items:[…]}`, verifiziert) → alle
  Bedingungen in EINER Query; **kein clientseitiges Merge/Dedupe nötig**.
- Begrenzte Treffermenge (MaxRecords 50, kein Auto-Paging). Ergebnisanzeige über
  die gemeinsame `TicketsList` (showFilters/showPager=false), kein neues Grid.
  Server-Page (BFF), kein separater API-Handler.

### [2026-06-03] B15-Vorab – Verifikation neue Dashboard-Kacheln (4 Stück)

Gegen die Sandbox verifiziert mit Resource **29682886** (Demo Teamlead,
`demo.lead`). Ziel: vier neue KPI-Kacheln ersetzen Offen/Überfällig/Heute fällig/SLA.
Status „offen" = `status ≠ 5` (5 = Abgeschlossen). **Noch keine UI** gebaut.

**Kachel 1 — Meine offenen Tickets**
- Quelle bestätigt: `POST Tickets/query/count`,
  Filter `assignedResourceID = <rid>` UND `status noteq 5`.
- Sandbox-Ergebnis: **27** (rid 29682886). Billiger Count-Endpoint, ein Request.

**Kachel 2 — Nicht zugewiesene Tickets (Pool)**
- Quelle bestätigt: `POST Tickets/query/count`,
  Filter `assignedResourceID notExist` UND `status noteq 5`.
- `notExist` ist der **korrekte** Null-Operator (NICHT das still ignorierte
  `noteExist`, vgl. B12). Sandbox-Ergebnis: **2** (plausibel, kleiner Pool;
  deckt sich mit den im Dashboard sichtbaren „—"-Tickets). Ein Request.

**Kachel 3 — Tickets, wo ich zusätzlicher Mitarbeiter (Secondary Resource) bin**
- Entität **`TicketSecondaryResources`** ist abfragbar, nach **`resourceID`
  filterbar** und liefert **`ticketID`** (Felder: `id, ticketID, resourceID`).
- Es gibt **keinen** direkten Count „offene Tickets, in denen ich Secondary bin".
  Bestätigter **Zwei-Schritt**:
  1. `POST TicketSecondaryResources/query`,
     Filter `resourceID = <rid>`, `IncludeFields:["ticketID"]` → alle `ticketID`
     einsammeln (paginieren falls > Seitengröße).
  2. `POST Tickets/query/count`,
     Filter `id in [<ticketIDs>]` UND `status noteq 5`.
- Sandbox-Ergebnis: rid 29682886 ist Secondary auf **139** Tickets (eine Seite,
  `nextPageUrl` null), davon **offen = 1**. Der `in`-Operator hat mit **139 IDs in
  einem Request** funktioniert.
- **Achtung Skalierung:** Wächst die TSR-Liste sehr groß, `in`-Liste in Blöcke
  (z. B. 200–300 IDs) splitten und Counts summieren. Caching wie bei den anderen
  KPIs (unstable_cache 60 s).

**Kachel 4 — „Ball liegt bei mir" (meine offenen, letzte Aktivität vom Kunden)**
- Feld **`lastActivityPersonType`** existiert auf Tickets. Picklist:
  **`1 = Resource` (Mitarbeiter), `2 = Contact` (Kunde)**. „Ball bei mir" = Wert
  **2**.
- **ABER** Feld ist `isQueryable: false` (und `isReadOnly: true`) → **kein
  serverseitiger Filter/Count möglich**. Ein billiger `query/count` mit
  `lastActivityPersonType eq 2` geht NICHT.
- Das Feld wird aber **pro Ticket mitgeliefert** (im `query`-Result vorhanden,
  Werte 1/2 gesehen). **Bestätigter Weg:** die ohnehin kleine Menge „meine offenen
  Tickets" (Kachel 1, hier 27 → eine Seite) mit
  `IncludeFields:[…,"lastActivityPersonType"]` holen und **clientseitig**
  `=== 2` zählen. Kein zweiter teurer Pfad, keine Notiz-Analyse.
- Sandbox-Ergebnis: von 27 offenen genau **1** mit `lastActivityPersonType = 2`
  (Ticket-ID 53159, `T20260216.0020`, Status 15 „Kundennotiz hinzugefügt").

**Fazit:** Alle vier Kacheln umsetzbar. K1/K2 = je ein Count-Request. K3 =
Zwei-Schritt (TSR → `in`-Count). K4 = ein `query` (meine offenen, inkl.
`lastActivityPersonType`) + clientseitiges Zählen `=== 2` — wegen
`isQueryable:false` KEIN Count-Endpoint. Schreibpfade: keine (alles lesend).

### [2026-06-03] Ticket-Bearbeitung – Schreibfelder verifiziert (gegen .env.local)

Verifiziert über den **App-Client** (`.env.local`-Mandant, NICHT MCP) an
**Ticket 43180** (Firma SSIG-IT Sandbox `companyID 0`, Kontakt Paul-Harald Katio
`30684646`). Alle Schreibtests mit anschließendem **Restore** auf die
Originalwerte (verifiziert: Ticket nach Lauf unverändert). Lesequelle für
Feld-Metadaten: `GET {Entity}/entityInformation/fields`.

**(a) Felder – schreibbar? Wertequelle? Pflicht?** (alle `isReadOnly:false`)

| Feld | schreibbar | Typ / Wertequelle | Pflicht |
|------|-----------|-------------------|---------|
| `status` | ja (getestet 11→8) | Picklist (17 Werte, V5) | **ja** |
| `priority` | ja (getestet 2→3) | Picklist (4, V5) | **ja** |
| `queueID` | ja | Picklist (7, V5) | nein |
| `assignedResourceID` | ja* | Referenz → `Resources` (aktiv, licenseType 1) | nein |
| `companyID` | ja* | Referenz → `Companies` | **ja** |
| `contactID` | ja* | Referenz → `Contacts` (gefiltert `companyID`) | nein |
| `configurationItemID` | ja* | Referenz → `ConfigurationItems` (gefiltert `companyID`) | nein |
| `contractID` | ja* | Referenz → `Contracts` (gefiltert `companyID`) | nein |
| `ticketCategory` | ja | Picklist (7) – **unabhängig** (Formular-Kategorie) | nein |
| `issueType` | ja | Picklist (26) – „Kategorie" | nein |
| `subIssueType` | ja* | Picklist (165) – „Unterkategorie", **abhängig** | nein |

`*` = mit Bedingungen, siehe (b)/(c).

**(b) Abhängige Picklist Kategorie→Unterkategorie**
- Das abhängige Paar ist **`issueType` (Kategorie) → `subIssueType` (Unterkat.)**.
  Beziehung steht in den Feld-Metadaten: jeder `subIssueType`-Picklistwert trägt
  `parentValue` = die zugehörige `issueType`-ID
  (z. B. subIssueType `11` „Server" `parentValue:"4"` = issueType „Upgrade").
  → UI lädt `subIssueType` einmal und **filtert clientseitig nach
  `parentValue === gewählter issueType`**.
- **Server erzwingt die Abhängigkeit:** `subIssueType` mit unpassendem Parent
  setzen → Fehler **„Value does not exist for child picklist: subIssueType"**.
  Also beim Speichern `issueType` + dazu passenden `subIssueType` zusammen senden.
- `ticketCategory` ist eine **separate, unabhängige** Picklist (Formular-Layout),
  nicht Teil dieser Hierarchie.

**(c) Firmen-Abhängigkeit der Referenzen (zentral)**
- `contactID`, `configurationItemID`, `contractID` **hängen an der `companyID`**.
  Auswahllisten je: `POST {Entity}/query` mit `Filter companyID = ticket.companyID`
  (verifiziert filterbar für Contacts, ConfigurationItems, Contracts).
- Server erzwingt die Zugehörigkeit:
  - Kontakt fremder Firma → **„contactID is not associated to the companyID or its
    Parent Company"**.
  - CI fremder Firma → **„The configurationItemID [x] is not associated with
    Company [0]"**.
- **`companyID` ändern, während alter Kontakt/CI noch gesetzt ist → wird
  ABGELEHNT** (gleicher contactID-Fehler). **Keine stille Kaskade/Invalidierung**;
  das Ticket bleibt unverändert (kein Teil-Update). Konsequenz für die UI:
  Firmenwechsel muss **im selben PATCH** kompatible (oder `null`) `contactID`/
  `configurationItemID`/`contractID` mitsenden. „Parent Company" ist erlaubt
  (Kontakt einer übergeordneten Firma geht).
- `assignedResourceID` ist **firmenunabhängig**, aber: Zuweisen erfordert
  **`assignedResourceID` UND `assignedResourceRoleID` zusammen** (sonst Fehler
  „you must assign both a assignedResourceID and assignedResourceRoleID").
  Gültige Rolle = eine, die die Resource hält (`ResourceRoles/query` nach
  `resourceID`; getestet OK mit Demo Teamlead 29682886 + roleID 29683392).

**(d) Zeiteintrag (Create)**
- `POST TimeEntries` bestätigt (neuer TimeEntry **id 30549** an Ticket 43180).
- Pflicht/Bedingungen: `resourceID` (REQ), für Ticketzeiten **`roleID`** (eine vom
  Resource gehaltene Rolle, via `ResourceRoles/query`). **Für Service-Tickets sind
  zusätzlich `startDateTime` UND `endDateTime` Pflicht** (Fehler ohne: „TimeEntries
  for Service tickets require a start and stop time."). `hoursWorked`,
  `dateWorked`, `summaryNotes` optional/empfohlen. (Ergänzt V3.)

**Slice-Plan (additiver Bau)** – als BACKLOG B15a/B15b/B15c aufgenommen:
- **Slice 1 (B15a):** Zeiteintrag-Create (resource+role via ResourceRoles,
  start/stop, summaryNotes).
- **Slice 2 (B15b):** einfache Ticket-Felder – Status / Priorität / Queue /
  Zuweisung (id+role) / Kategorie (issueType+subIssueType mit parentValue-Filter).
- **Slice 3 (B15c):** firmenabhängige Referenzen – Firma / Kontakt / Gerät /
  Vertrag inkl. companyID-Filterung und „beim Firmenwechsel Refs mitsenden/leeren".

### [2026-06-03] B15a umgesetzt – Zeiteintrag erfassen (erstes Schreib-Feature)

Erstes Write-Feature, end-to-end gegen `.env.local` verifiziert (Ticket 43180,
TimeEntry-ids 30550 + 30551 angelegt). Disziplin etabliert: Browser ruft nur die
interne Route `POST /api/tickets/[id]/time` (Creds server-only); Lade-/Disabled-
State, Fehler sichtbar im Dialog, Erfolg via `sonner`-Toast + `router.refresh()`.

- **Tätigkeitsart = `TimeEntries.billingCodeID`** (Referenz → `BillingCode`,
  schreibbar, optional in der API – im UI als Pflicht geführt). Auswahlwerte =
  **`BillingCodes` mit `useType = 1`** (aktive Work Types), z. B. **Remote-Support**
  (`29682801`), Vor Ort-Service, Monitoring, Wartungsarbeiten … `useType` trennt
  Work-Types (1) von Spesen (2), Nicht-abrechenbar (3), Material (4) usw.
- **Rolle** (`roleID`, bei Ticket-Zeiten Pflicht) wird **NICHT** mehr im UI gewählt
  („immer dieselbe") – die Route setzt server-seitig die **erste aktive Rolle** des
  Users (`ResourceRoles/query`).
- **„Zusammenfassung an die Lösung anhängen"**: optionaler Schalter; hängt
  `summaryNotes` an das Ticket-Feld **`resolution`** an (string, schreibbar).
  `tickets.appendResolution` liest den Bestand und ergänzt zeilenweise (verifiziert:
  resolution gesetzt, danach für den Testlauf wieder geleert).
- Stunden werden aus Von/Bis berechnet und immer als `hoursWorked` zusammen mit
  `startDateTime`+`endDateTime` gesendet (deckt Service-Tickets ab).
- Neue shadcn-Komponenten: `dialog`, `sonner` (Toaster im App-Layout gemountet).

### [2026-06-03] B15b umgesetzt – Ticket-Felder inline bearbeiten

Inline-Editoren in der Meta-Spalte des Ticketdetails; jede Änderung speichert über
`PATCH /api/tickets/[id]` (Whitelist server-only), bei Erfolg `router.refresh()` +
`sonner`-Toast, bei Fehler Reset auf den alten Wert + Inline-Fehlertext. Verifiziert
gegen `.env.local` an Ticket 43180 (alle PATCH 200).

- **Status / Priorität / Queue**: je ein shadcn-Select, speichert bei Änderung
  (verifiziert persistent, z. B. Queue → „Level II-Support"/29682969).
- **Kategorie → Unterkategorie** (`issueType` → `subIssueType`): zwei gekoppelte
  Selects. `subIssueType` wird clientseitig nach `parentValue === issueType`
  gefiltert (verifiziert: Backup→Datto-Restore vs. Netzwerk→Firewall/Switch/WLAN…).
  Kategoriewechsel sendet `{ issueType, subIssueType: null }` (Unterkategorie wird
  zurückgesetzt). `ticketCategory` bewusst NICHT im UI.
- **Zuweisung** (gekoppelt): Resource-Select (aktive interne Resources) → Rollen der
  Resource via `GET /api/resources/[id]/roles` (`ResourceRoles/query`); **eine
  Rolle → automatisch gespeichert, mehrere → zweites Rollen-Select**. Es wird IMMER
  `assignedResourceID` + `assignedResourceRoleID` ZUSAMMEN gesendet (verifiziert:
  Body `{assignedResourceID:29682886, assignedResourceRoleID:29683392}`). „Nicht
  zugewiesen" sendet beide `null`. Rollennamen aus `Roles` (Fallback „Rolle #id").
- PATCH-Route erzwingt die Kopplung (Resource xor Rolle → 400) und whitelistet nur
  status/priority/queueID/issueType/subIssueType/assignedResourceID/
  assignedResourceRoleID.
- **Hinweis Sandbox:** Ticket 43180 wird von aktiven Autotask-Workflow-Regeln
  („Eskalation nach Fälligkeitsüberzug" u. a., „Eingeleitet von N8n API")
  fortlaufend selbst verändert (Status/issueType driften). Das ist Umgebungs-
  Automation, kein App-Verhalten; unsere PATCHes persistieren (unmittelbar nach
  Refresh bestätigt).

### [2026-06-03] OFFEN (Pre-Prod): Inbound-noteType nicht verifiziert
- Der Chat erkennt Richtung über `CONVERSATION_TYPE_IDS` = **18 outbound / 101
  inbound** (`lib/autotask/conversation.ts`). **`101` für eingehende Kundenmails
  ist eine ANNAHME**, nicht verifiziert: die Sandbox kann keine echte Mail
  empfangen (V2).
- **Risiko:** Kommt eine echte Antwort in Prod mit einem anderen noteType,
  **erscheint sie nicht im Chat** (Filter nur 18/101).
- **Zu tun (sobald Prod-Mail steht):** echte Antwort an ein Test-Ticket →
  `TicketNotes/query` (ticketID) → `noteType` + `createdByContactID` prüfen →
  `CONVERSATION_TYPE_IDS` bestätigen/anpassen. Optional Near-Realtime via
  `TicketNoteWebhook` statt Polling. Backlog: **B17a** (Pre-Prod, Nähe B17).

### [2026-06-03] B15c umgesetzt – firmenabhängige Referenzen (Schreibpfad)

Suchbare shadcn-Comboboxen (Popover + Command) in der Meta-Spalte; gegen
`.env.local` an Ticket 43180 verifiziert.

- **Kontakt / Gerät / Vertrag**: je eine **firmengefilterte** Combobox. Optionen
  serverseitig nach `ticket.companyID` vorgeladen (`Contacts`/`ConfigurationItems`/
  `Contracts` mit `Filter companyID`), in `getTicketDetail` gebündelt. Speichert bei
  Wahl als Einzelfeld-PATCH (`{contactID}` etc.; verifiziert `{contactID:30682973}`
  → 200, persistent). „— Keine" sendet `null`. **Fremde Refs werden gar nicht erst
  angeboten** (Picker nur same-company); zusätzlich lehnt Autotask Mismatches ab
  (server-seitiger Schutz).
- **Firma ändern**: bewusste Aktion über Dialog (NICHT save-on-change) mit
  **asynchroner Firmensuche** (`GET /api/companies?q=` → `companyName contains`,
  debounced). Warnt, dass Kontakt/Gerät/Vertrag zurückgesetzt werden.
- **Kaskade beim Firmenwechsel (NEU/korrigiert):** Autotask kaskadiert nicht und
  lehnt den PATCH ab, solange firmengebundene Felder noch zur alten Firma gehören.
  Im selben PATCH müssen **alle** genullt werden:
  `contactID`, `configurationItemID`, `contractID` **UND `companyLocationID`**.
  → `companyLocationID` war in der B15-Vorab-Verifikation noch nicht aufgetaucht;
  hier per echtem Fehler entdeckt: *„The companyLocationID[1] cannot be associated
  with the Ticket. The CompanyLocation must belong to the Ticket's,
  ConfigurationItem's, or the Contact's Company."* Nach Hinzunahme von
  `companyLocationID: null` → PATCH 200, Wechsel + Reset persistent (verifiziert:
  Sandbox → Beispielfirma C GmbH → zurück zu Sandbox).
- PATCH-Whitelist erweitert um companyID/contactID/configurationItemID/contractID/
  **companyLocationID**.

### [2026-06-03] B16a umgesetzt – Entra-ID-Login (Auth.js v5), deployment-agnostisch

- **Auth.js v5** (`next-auth@beta`) + **Microsoft-Entra-ID-Provider**, reines OIDC
  (`openid profile email`, kein Graph). **JWT-Session** (stateless, keine DB) →
  läuft auf Hetzner/Docker hinter Caddy UND Vercel; keine Vercel-only-Abhängigkeit.
  Node-Runtime für die Auth-Route; **kein `middleware.ts`** (Route-Schutz server-
  seitig im Layout via `requireSession()`).
- Einbettung ohne Bruch des Mock-Modus: `lib/auth/authjs.ts` (NextAuth-Config),
  `entra-provider.getSession()` mappt die Auth.js-Session → dieselbe `SessionUser`;
  Auth.js wird LAZY importiert (Mock lädt die Library nie). `AUTH_MODE` bleibt die
  einzige Weiche.
- **Email → resourceID** im `jwt`-Callback (einmal beim Sign-in, im JWT gecacht):
  `resources.byEmail(email)` → `Resources/query` (eq email + isActive). Verifiziert
  gegen `.env.local`: Treffer `teamlead@example.com` → **id 29682886**;
  Kein-Treffer → **null** (es wird NIE eine resourceId fabriziert).
- **NO_RESOURCE-Fall:** kein halber Login. `getSession()` → null; `requireSession()`
  unterscheidet: bei Entra angemeldet aber ohne Resource → **`/no-access`**
  (eigene Seite + Abmelden), sonst → `/login`. `roles` Default `["agent"]` (kein
  Gating, B12).
- **Sandbox-Caveat:** Backend bleibt Sandbox; nur E-Mails, die einer Sandbox-
  Resource gehören, mappen (viele teilen `qalab@autotask.com`). Erster echter
  OIDC-Test mit passender Mail oder eine Sandbox-Resource kurz auf die Entra-Mail
  setzen.
- **Env (nur bei `AUTH_MODE=entra`):** `AUTH_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ID`,
  `AUTH_MICROSOFT_ENTRA_ID_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ISSUER`
  (`…/<TENANT_ID>/v2.0`), `AUTH_URL`, `AUTH_TRUST_HOST=true`. Redirect-URI:
  `<AUTH_URL>/api/auth/callback/microsoft-entra-id`.
- Verifiziert (headless): Build grün; Mock-Modus unverändert; `/no-access` rendert;
  im Entra-Modus zeigt `/login` „Mit Microsoft anmelden" und `/` leitet ohne
  Session nach `/login` um. Der echte OIDC-Round-Trip ist Pauls Test.

## 2026-06-03 — Ticketdetail-Umbau (3 Spalten) + neue Lese-Felder (verifiziert)

Positionsgetreuer Nachbau des Autotask-Ticketlayouts (links Meta / Mitte Inhalt+Tabs /
rechts Kontext). Rein präsentational + neue LESE-Daten. Feldnamen gegen die Sandbox
verifiziert (`autotask_get_field_info` bzw. `.env.local`-Probe):

- **Tickets.resolution** (string, 32000) ✓ → „Lösung"-Abschnitt. **ticketType** +
  **source** sind Picklists auf Tickets → in `getTicketPicklists` ergänzt
  (Kopf-Typ-Badge „Service-Anfrage", Quelle „Telefon"). `tickets.get` liefert den
  VOLLEN Datensatz (GET /Tickets/{id}, ohne IncludeFields) → resolution/source/
  ticketType/estimatedHours sind ohne Mehrkosten da.
- **Contacts**: `phone`, `mobilePhone`, `title` ✓ (Kontaktpanel).
- **Companies**: `address1/address2/city/postalCode/state/phone` ✓ → `companies.get`
  (Firmenanschrift im Kontextpanel).
- **ConfigurationItems**: `serialNumber`, `location`, `installDate`,
  `warrantyExpirationDate`, `referenceTitle/Number` ✓ (Gerät-Detailkarte).
- **TimeEntries**: `hoursToBill` + `billingCodeID` zu IncludeFields ergänzt →
  Abrechenbar = Σ hoursToBill, Nicht abrechenbar = Σ hoursWorked − Σ hoursToBill;
  Tätigkeitsart = BillingCodes-Name (workTypes-Map), Mitarbeiter = resourceID-Name.
  Stunden-Anzeige als „H:MM Std" (`lib/format.ts`).

### Anhänge — BEFUND (wichtig)
- **Liste:** `POST /TicketAttachments/query` mit `Filter parentID eq {ticketId}` ✓.
  Der geparente Pfad `Tickets/{id}/Attachments/query` existiert NICHT (404). Child-
  **GET** `Tickets/{id}/Attachments` liefert volle Datensätze (nur Lesen).
- **Download:** `data` (base64) NUR über Top-Level `GET /TicketAttachments/{id}` →
  interne Route `/api/tickets/[id]/attachments/[aid]` (server-only, Zugriffsschutz:
  parentID/ticketID muss passen). Liste/Download sind gebaut.
- **ABER:** Mit den **App-Credentials aus `.env.local`** liefert die Anhang-Query
  HTTP 200 mit **0 Treffern** und der Download `500 „Attachment could not be found."`
  — obwohl das Ticket (z. B. 30023) real 2 Anhänge hat (für die MCP-/Admin-Creds
  sichtbar). Ursache: **Security-Level des API-Users** (Anhang-Sichtbarkeit), kein
  Code-Fehler. → Anhänge-Tab zeigt sauberen Empty-State; sobald der Integration-User
  Anhangsrechte hat, funktioniert beides ohne Änderung.

Verifiziert: Build grün; Screenshots Hell/Dunkel Desktop (alle Tabs) + Mobile
(`docs/visual-refresh/detail2-*`); Inline-Edits/Zeit-erfassen/Chat unverändert.

## 2026-06-04 — Nachtlauf-Slices

### [2026-06-04] Slice 1 umgesetzt – Neues Ticket erstellen (Schreibpfad)

Erster Create-Schreibpfad. End-to-end gegen `.env.local` verifiziert; beide
Test-Tickets an Firma SSIG-IT Sandbox (`companyID 0`) / Kontakt Paul-Harald Katio
(`30684646`), danach auf `status=5` (Abgeschlossen) gesetzt.

- **POST Tickets (Top-Level)** verifiziert: `itemId 43181` (API-Probe) und
  `43182` (`T20260604.0002`, UI-End-to-End). `autotask.create("Tickets", data)`.
- **Pflichtfelder** laut `Tickets/entityInformation/fields` (`isRequired`):
  **companyID, priority, status, title** (`id` ist RO/auto).
- **NEUER verifizierter Constraint (nicht in `isRequired`):** Beim Anlegen verlangt
  Autotask zusätzlich **mindestens `queueID` ODER (`assignedResourceID` +
  `assignedResourceRoleID`)**. Ohne beides Fehler: *„assignedResourceID,
  assignedResourceRoleID, and queueID cannot all be empty. Supply a queueID or both
  an assignedResourceID and assignedResourceRoleID."* (im Browser belegt). Die UI
  prüft das **clientseitig vor** (klare deutsche Meldung statt roher API-Fehler +
  dauerhafter Hinweistext unter dem Queue-Feld). Default-UX: Queue „— Keine".
- **Route `POST /api/tickets`** (BFF, Whitelist): `title` (Pflicht, String) +
  numerisch `companyID/status/priority` (Pflicht), optional `queueID/contactID/
  issueType/subIssueType/assignedResourceID/assignedResourceRoleID/description`.
  Zuweisung gekoppelt (Resource xor Rolle → 400). Pflichtfeld-Check serverseitig.
- **Neue Hilfsrouten:** `GET /api/contacts?companyId=` (aktive Kontakte EINER Firma,
  für den firmengefilterten Kontaktpicker), `GET /api/resources` (aktive interne
  Mitarbeiter, licenseType 1; lazy für die Zuweisungs-Auswahl).
- **UI:** `components/tickets/new-ticket-dialog.tsx` (shadcn `Dialog` + `Popover`/
  `Command`-Firmensuche wie B15c + firmengefilterter Kontaktpicker + `Select`s;
  Kategorie→Unterkategorie nach `parentValue` gekoppelt; Zuweisung Resource+Rolle
  gekoppelt). Default **Status = Neu (1)**, **Priorität = Mittel (2)**. Erfolg →
  `router.push(/tickets/{itemId})` + `sonner`-Toast. „Neues Ticket"-Button in den
  Headern aller Listen-Seiten (my/team/secondary/ball).
- **Verifiziert:** Build grün; Browser Hell + Dunkel + Mobile
  (`docs/visual-refresh/slice1/*`); echter UI-Create (43182) inkl. Redirect ins
  Detail; Guard-Pfad zeigt die deutsche Meldung **ohne** API-Call.

### [2026-06-04] Slice 2 umgesetzt – Interne Notiz (Aktivität-Feed)

„Neue Notiz" im Aktivität-Bereich des Ticketdetails. **KRITISCH erfüllt: nie
kundensichtbar.**

- **Fest interner Typ:** `INTERNAL_NOTE = { noteType: 2 (Aufgabendetails),
  publish: 1 (All Autotask Users = intern) }` in `lib/autotask/entities/
  ticket-notes.ts`. **NIEMALS noteType 18** (Kundenportal) und **NIEMALS das UDF
  „Kunde benachrichtigen"** – die Notiz löst keine Kundenmail aus.
- **Verifiziert (2026-06-04) gegen `.env.local`:** Note `29926308` (Frischticket
  43183) und Note `29926309` (UI-Test an 43180) je `noteType 2 / publish 1`. UDF
  „Kunde benachrichtigen" vor UND nach der Notiz unverändert (Frischticket „nicht
  gesetzt"; 43180 = „Nein"). 43180/43183 an Test-Firma (`companyID 0`) / Kontakt
  Paul-Harald Katio (qalab-Catch-all). `title` ist bei TicketNotes Pflicht
  (DECISIONS B11) → bei leerem Titel aus der ersten Textzeile abgeleitet.
- **Route `POST /api/tickets/[id]/note`** (BFF): nur `title?`/`text`; `text` Pflicht;
  ruft `ticketNotes.createInternal`. Keine noteType/publish/UDF aus dem Body.
- **UI:** `components/tickets/note-form.tsx` – inline aufklappbares Formular im
  Aktivität-Header (Titel optional, Notiz, Hinweis „Interne Notiz – für den Kunden
  nicht sichtbar"). Erfolg → `sonner`-Toast + `router.refresh()` → erscheint im Feed
  (Badge „Aufgabendetails"). Verifiziert: Build grün; Hell + Dunkel + Mobile
  (`docs/visual-refresh/slice2/*`); Notiz erscheint nach Speichern im Feed.

### [2026-06-04] Slice 3 umgesetzt – Stoppuhr am Ticketdetail

Client-seitige Stoppuhr im Zeiten-Tab-Header; **kein neuer API-Pfad**.

- **`components/tickets/stopwatch.tsx`:** Start / Pause / Fortsetzen / Stopp +
  Zurücksetzen. Laufzeit aus `Date.now()` + Sekunden-Intervall (nur Anzeige);
  Pause akkumuliert, Fortsetzen rechnet weiter. Reiner Client-State, keine
  Persistenz (Reload setzt zurück – bewusst, „einfachste robuste Lösung").
- **Stopp → bestehender Zeit-erfassen-Dialog vorbefüllt:** `TimeEntryDialog` um
  einen optional **kontrollierten Modus** erweitert (`open`/`onOpenChange`,
  `initialDate/From/To`, `showTrigger`, `onSaved`). Die Stoppuhr berechnet
  **Von = Stoppzeit − gemessene Dauer**, **Bis = Stoppzeit**, Datum = heute, und
  öffnet den Dialog damit. Die manuelle „Zeit erfassen"-Schaltfläche bleibt
  unverändert (eigene, unkontrollierte Instanz).
- **Datenerhalt:** Stopp pausiert nur (Wert bleibt erhalten), falls der Dialog
  abgebrochen wird; `onSaved` setzt die Uhr nach erfolgreichem Speichern zurück.
- **Hinweis Granularität:** Von/Bis werden als `HH:MM` vorbelegt → Läufe unter
  einer Minute ergeben Dauer 0:00 (im Dialog editierbar). Akzeptiert.
- **Verifiziert (Browser):** Start→Pause(29s)→Fortsetzen→Stopp bei 01:09; Dialog
  öffnete mit Datum 04.06.2026, Von 09:38 / Bis 09:39, Dauer 0:01 Std; Abbrechen
  erhielt den Uhrwert. Build grün; Hell + Dunkel + Mobile
  (`docs/visual-refresh/slice3/*`). Kein Schreibzugriff durch die Uhr selbst.
- **Nachjustierung (Paul, 2026-06-04):** UI vereinfacht → `components/tickets/
  time-tracking.tsx` (ersetzt `stopwatch.tsx`). **Umrahmte** Zeitanzeige, **eine
  Play/Pause-Taste** (Icon) und ein **Stopp-Knopf (Quadrat) daneben** = anhalten +
  zurücksetzen (danach steht wieder Play allein). **Kein „Stopp→Dialog"** mehr –
  stattdessen öffnet die bestehende **„Zeit erfassen"-Schaltfläche** den Dialog und
  übernimmt die gemessene Dauer vorbefüllt (Uhr wird beim Öffnen angehalten). Grund:
  doppelte Controls vermeiden (siehe Memory [[stopwatch-ux-preference]]).
- **Nachjustierung 2 (Paul, 2026-06-04):** Stopp-Taste **immer** neben der
  Play/Pause-Taste sichtbar (gleiches Format, outline icon-sm) = anhalten + auf 0
  zurücksetzen. **Timer startet automatisch beim Öffnen eines Tickets** (Mount-Effekt).
  „Zeit erfassen" bleibt der Weg zum Vorbefüllen. Im Browser bestätigt (Auto-Start
  läuft, beide Tasten dauerhaft sichtbar).

### [2026-06-04] Slice 5 umgesetzt – Command-Palette (Cmd/Ctrl+K)

Globale Palette für Navigation + Ticketsuche.

- **`components/command-palette.tsx`** (shadcn `CommandDialog` = cmdk): global im
  `(app)`-Layout gemountet. Öffnen per **Cmd/Ctrl+K** (Keydown-Listener) ODER per
  Custom-Event `open-command-palette` (von der Header-Suche dispatcht).
- **`shouldFilter={false}`** auf dem cmdk-`Command`: Navigation wird selbst nach der
  Eingabe gefiltert, Ticket-Treffer kommen serverseitig (sonst würde cmdk
  Firma-/Nummer-Treffer wegfiltern, deren Titel den Suchbegriff nicht enthält).
- **Ticketsuche** über neue Route **`GET /api/tickets/search?q=`** → bestehende
  `searchTickets`-Logik (B08, Nummer/Titel/Firma/Kontakt), Top 8. Statischer Pfad
  `tickets/search` hat Vorrang vor `tickets/[id]` (kein Routing-Konflikt).
- **Header-Suche umgebaut** (`header-search.tsx`): kein Navigations-Formular mehr,
  sondern Auslöser der Palette – Desktop = suchfeld-artiger Button mit `⌘K`/`Strg K`
  (plattformabhängig), Mobile = Such-Icon. Beide dispatchen das Öffnen-Event.
- Treffer-Klick → `router.push`. Verifiziert (Browser): Ctrl+K öffnet, Header-Button
  öffnet, Navigation + Ticketsuche („Phase-0" → T20260601.0001) funktionieren,
  Klick navigiert ins Detail. Build grün; Hell + Dunkel + Mobile
  (`docs/visual-refresh/slice5/*`).

### [2026-06-04] Slice 6 umgesetzt – Seite „Meine Zeiten" (read)

Neue Nav-Seite `/zeiten`: eigene Zeiteinträge, Umschalter Heute / Diese Woche,
Summen, Liste mit Ticket-Link. **Rein lesend** (V3).

- **`timeEntries.byResourceBetween(resourceId, fromIso, toIso)`** – Query
  `resourceID eq` + `dateWorked` gte/lte. **Verifiziert (2026-06-04):** Demo Teamlead
  (29682886) hat 4 Einträge im Juni (Ticket 43180). **`dateWorked` wird als
  UTC-Mitternacht gespeichert** (z. B. `2026-06-03T00:00:00.000Z`) → Bereichsgrenzen
  als **UTC-Tagesgrenzen** aus dem lokalen Kalenderdatum gebaut (TZ-robust für am
  UTC-Tagesanfang abgelegte Werte; dokumentierte Näherung wie beim Dashboard).
- **`lib/autotask/entities/my-time.ts` `getMyTimeEntries(resourceId, range)`**:
  Bereich heute / Woche (Mo–So), Tickets (Nummer/Titel) + Tätigkeitsarten gebündelt
  via `in` aufgelöst (kein N+1). Summen wie im Ticketdetail: Gesamt = Σ hoursWorked,
  Abrechenbar = Σ hoursToBill, Nicht abrechenbar = Gesamt − Abrechenbar.
- **UI:** `app/(app)/zeiten/page.tsx` (Server) + `RangeToggle` (Client, `?range=`),
  3 Summen-`Card`s, `Table` (Datum / Ticket-Link / Tätigkeit-Badge / Dauer /
  Abrechenbar), `Empty`-Zustand, `loading.tsx`-Skeleton. Nav „Meine Zeiten" in
  Sidebar + Command-Palette + Header-Titel ergänzt.
- **Verifiziert (Browser):** Heute (4. Juni) = Empty; Diese Woche = 4 Einträge,
  Summe 2:45 Std (0:15+1:00+1:00+0:30), Abrechenbar 2:45, Ticket-Links →
  `/tickets/43180`. Build grün; Hell + Dunkel + Mobile (`docs/visual-refresh/slice6/*`).

### [2026-06-04] Slice 7 umgesetzt – Playwright-Smoke-Suite

Wiederholbare E2E-Tests der Kernpfade.

- **`@playwright/test`** als devDependency; `playwright.config.ts` (testDir `e2e/`,
  baseURL :3000, **ein Worker**/seriell wegen Schreibtest, `webServer` startet
  `npm run dev` bzw. nutzt einen laufenden Server). Mock-Login einmal in
  `e2e/auth.setup.ts`, Cookie als `storageState` für alle Tests geteilt.
- **`e2e/smoke.spec.ts` (9 Tests, alle grün):** Dashboard-KPIs, Meine Tickets
  (Tabelle), Teamtickets, Meine Zeiten (Summen), Ticketdetail, Command-Palette
  (Cmd+K findet T20260601.0001 → Navigation), Zeit-erfassen-Dialog, Neues-Ticket-
  Dialog, **Status-Inline-Edit am Testticket 43180 (ändern + zurücksetzen)**.
- **Robustheit Status-Test:** 43180 trägt teils einen workflow-gesetzten Status
  (z. B. „Fälligkeit überschritten"), der NICHT in der manuell wählbaren Picklist
  steht → Test liest den Ausgangswert dynamisch und setzt, falls nicht wählbar, auf
  einen neutralen Standard zurück (Workflow re-setzt den Auto-Status ohnehin selbst).
- Scripts: `npm run test:e2e` / `test:e2e:ui`. Artefakte (`playwright-report/`,
  `test-results/`, `e2e/.auth/`) sind gitignored. Kurz-Doku: `e2e/README.md`.
- **Ergebnis:** `npx playwright test` → **10 passed** (Setup + 9). Schreibzugriff
  nur am Testticket 43180, nichts gelöscht.

### [2026-06-04] Slice 8 – Konsistenz-Sweep (rein präsentational)

Kleiner Politur-Durchgang, keine Logik geändert.

- **Hard-Rule-Check (tonight's Code):** keine `style=`, keine Emojis. Einzige
  Off-Token-Stelle behoben: `text-[10px]` → `text-xs` (Header-Kürzel). `max-h-[60vh]`
  (Scroll-Container Neues-Ticket-Dialog) und `w-(--anchor-width)` (base-ui-Popover,
  wie vendored `select.tsx`) bewusst beibehalten – strukturell/idiomatisch, keine
  erfundene Optik. Arbitrary Values sonst nur in den vendored `components/ui/*`.
- **Konsistenz:** „Meine Zeiten"-Summenkarten an die Dashboard-KPI-Karten angeglichen
  (`CardDescription` + große `CardTitle` statt eigener Label/Value-Markup). Geteilte
  `TicketsList`-Empty bekommt – wie die anderen Empty-Zustände (Zeiten, Anhänge) –
  ein `EmptyMedia`-Icon.
- Bestätigt vorhanden/konsistent: Error = `Alert variant="destructive"` überall;
  Loading-Skeletons (global `loading.tsx` + spezifische my/zeiten/detail); Focus-
  Ringe (shadcn focus-visible + KPI-Karten); semantische Tokens (AA Hell/Dunkel).
- **Offen (bewusst NICHT angefasst, = Logik):** klickbare `TableRow`s in `TicketsList`
  sind per Maus, aber nicht per Tastatur navigierbar (kein role/tabIndex/onKeyDown).
  A11y-Verbesserung für später vorgemerkt; im /zeiten-Table ist der Ticket-Link
  bereits ein echtes `<Link>` (tastaturbedienbar).

### [2026-06-04] Slice 9 – Doku auf Stand

- **Root `README.md`** ersetzt das create-next-app-Boilerplate: Zweck (BFF), Stack,
  Setup/`.env.local`, Befehle (inkl. `test:e2e`), Auth-Modi, Schreib-/Test-Disziplin,
  Funktionsumfang.
- **Neu `docs/ARCHITECTURE.md`** – die in der Architektur-Entscheidung [2026-06-01]
  vorgesehene Repo-Karte: Datenfluss (BFF), Verzeichnisse, Entity-Wrapper-Liste,
  Prinzipien, Konventionen.
- **`docs/README.md`** entstaubt („enthält noch keinen Code" → aktueller Stand) +
  Verweis auf ARCHITECTURE.
- `DECISIONS.md` / `BACKLOG.md` wurden bereits je Slice fortgeschrieben.

## 2026-06-04 — Folge-Lauf: Teil A (Follow-ups) + Firmen/Kontakte (Kundenakte)

### [2026-06-04] A1 umgesetzt – Neues Ticket: Standard-Queue „Level I-Support"
- **Zentrale Konstante `NEW_TICKET_DEFAULT_QUEUE = 29682833`** (Level I-Support) in
  `lib/autotask/new-ticket.ts`. Der Neues-Ticket-Dialog belegt die Queue beim Öffnen
  und beim Zurücksetzen damit vor (`defaultQueue(picklists.queue)`), sofern die ID in
  der Picklist vorhanden ist; sonst Fallback auf „— Keine".
- **Verifiziert (2026-06-04, gegen `.env.local`):** Queue-Picklist (App-Mandant)
  enthält `29682833 = Level I-Support` (`node --env-file=.env.local scripts/verify-api.mjs
  fieldsc Tickets`). Im Browser bestätigt: Dialog öffnet mit Queue = „Level I-Support"
  vorausgewählt, der Constraint-Hinweis („Queue oder Zuweisung") erscheint dadurch
  nicht mehr.
- **Guard bleibt:** Die clientseitige Prüfung `needsQueueOrAssignment` ist unverändert
  – greift nur noch, wenn der Nutzer die Queue bewusst auf „— Keine" stellt und auch
  nicht zuweist. Kein Server-/Schreibpfad geändert. Build grün; Hell + Dunkel + Mobile
  (`docs/visual-refresh/A1/`).

### [2026-06-04] A2 umgesetzt – Playwright-Schreibtest hinter Env-Flag
- Der einzige Schreibtest (Status-Inline-Edit an 43180) ist lokal **standardmäßig
  aktiv** und lässt sich über **`E2E_SKIP_WRITE_TESTS`** (`1`/`true`/`yes`) abschalten
  (`test.skip(...)` zu Test-Beginn, `SKIP_WRITE_TESTS`-Konstante in `e2e/smoke.spec.ts`).
  Doku-Abschnitt in `e2e/README.md`.
- **Verifiziert (2026-06-04):** `E2E_SKIP_WRITE_TESTS=1 … -g "Status inline"` →
  **1 skipped** (Setup ok, kein Write); ohne Flag → **2 passed** (Write+Restore an
  43180). Reine Test-Infrastruktur – kein App-Code, kein `next build` betroffen.

### [2026-06-04] A3 umgesetzt – Anhänge: Lesen/Download bestätigt + Upload gebaut
**Aktualisiert den Befund „Anhänge — BEFUND" vom 2026-06-03 (damals 0 Treffer + 500
beim Download).** Der App-API-User (`.env.local`) sieht jetzt FILE-Anhänge; der volle
Round-Trip funktioniert.
- **Re-Verifikation (2026-06-04, gegen `.env.local`):**
  - `TicketAttachments/query` liefert wieder Treffer (vorher 0). Alt-Anhänge fremder
    Tickets (z. B. 30023) bleiben für diesen User teils unsichtbar (URL-Reste /
    Security-Level) – für die App-Nutzung unkritisch.
  - **Round-Trip an Testticket 43180:** `POST Tickets/43180/Attachments`
    (`attachmentType FILE_ATTACHMENT`, base64 `data`, `publish 1`) → `itemId`; danach
    `TicketAttachments/query parentID=43180` zeigt den Anhang; `GET
    TicketAttachments/{id}` liefert `data` (base64) → **inhaltsgleich** dekodiert.
    Antwortform von GET-by-id ist `{ items: [...] }` (kein `{ item }`); `autotask.get`
    liest bereits `items[0]`.
  - **`contentType` ist read-only** (REQ,RO) → NICHT mitsenden; Autotask leitet ihn
    aus der Dateiendung ab (z. B. `.txt` → `text/plain`).
  - **`DELETE TicketAttachments/{id}` → 405** (nicht unterstützt). Test-Anhänge
    (ids 33662/33663, `ZZZ TEST`) bleiben am Testticket 43180 – per API nicht löschbar.
- **Gebaut (Upload):** `attachments.upload(ticketId, {fileName, dataBase64})`
  (Eltern-Pfad `Tickets/{id}/Attachments`); Route `POST /api/tickets/[id]/attachments`
  (serverseitiger Größen-Check, max **10 MB** → HTTP 413); Client `AttachmentUpload`
  (versteckter File-Input + shadcn-`Button`, base64 clientseitig via `FileReader`,
  `sonner`-Toast + `router.refresh()`). Geteilte Grenze in
  `lib/autotask/attachments-shared.ts`. Liste + Download bestanden bereits
  (Ticketdetail-Umbau 2026-06-03), zeigen jetzt echte Anhänge.
- **UI-Verifikation (Browser, 43180):** „Neuer Anhang" → Datei → Tab „Anhänge (2)",
  neuer Eintrag `ui-upload-sample.txt` (65 B). API-Gegenprobe: hochgeladener Inhalt
  dekodiert **identisch** (MATCH true, id 33663). Build grün; Hell + Dunkel + Mobile
  (`docs/visual-refresh/A3/`).
- **→ Für Paul:** Anhang-Rechte des API-Users sind offenbar inzwischen gesetzt
  (Upload/Download laufen). Einzige Einschränkung: API kann Anhänge nicht löschen
  (kein DELETE-Endpoint) – Aufräumen nur über die Autotask-UI.

### [2026-06-04] B2 umgesetzt – Firmenliste (/companies)
- **Daten (verifiziert gegen `.env.local`):** **637 aktive Firmen**; **184 offene
  Tickets** (status≠5) gesamt über 25 Firmen. `companies.listActive()` (IncludeFields
  id/companyName/city/phone, isActive=true, gepaged, **Cap 1000**, 60 s gecacht). Spalte
  „offene Tickets" aus EINEM gebündelten Open-Ticket-Abruf
  (`tickets.openCompanyCounts()`, nur id/companyID, clientseitig nach companyID
  gruppiert, Cap 5000, 60 s) – **kein Count pro Firma**. Zusammenführung in
  `lib/autotask/entities/company-list.ts#getCompaniesList`.
- **Cross-Check (2026-06-04):** Grouping == Count-Endpoint je Firma: SSIG Sandbox 62,
  Beispielfirma (companyID 222) 24, Beispielfirma B (283) 17 – alle **MATCH**.
- **UI:** `app/(app)/companies/page.tsx` (Server) + `CompaniesTable` (Client):
  Tippen-Filter (Name/Ort), clientseitige Sortierung über die Spaltenköpfe (Server
  sortiert nicht, B13), Zeilenklick → Kundenakte. Tabelle `table-fixed` +
  Spaltenbreiten + `min-w-2xl` → passt am Desktop, scrollt horizontal am Handy
  (Name-Spalte umbricht). „~"-Kennzeichnung + Hinweis, falls ein Cap erreicht würde
  (aktuell nicht). `header-title.tsx` um „Firmen"/„Kontakte" ergänzt. Build grün;
  Hell + Dunkel + Mobile (`docs/visual-refresh/B2/`).
- **Abweichung dokumentiert:** Cap **1000** statt der ursprünglich genannten ~500,
  damit alle 637 aktiven Firmen erscheinen (sonst wären Liste + Firmensuche
  unvollständig). Bleibt begrenzt; bei Überschreitung greift die „~"-Kennzeichnung.

### [2026-06-04] B3 umgesetzt – Kundenakte (/companies/[id])
- **Kopf:** `companies.get(id)` (GET liefert den vollen Datensatz inkl. neu typisiertem
  `webAddress`) → Name (h1), Adresse (`address1, PLZ Ort, state`), Telefon, Web (Link,
  `https://` ergänzt falls Schema fehlt). „← Firmen"-Backlink. Button **„Neues Ticket
  für diese Firma"**.
- **Tabs (URL-gesteuert über `?tab=`):** `CompanyTabs` (Client) navigiert beim
  Tabwechsel zu `?tab=…` (verwirft `cursor`); der Server lädt **nur** die Daten des
  aktiven Tabs (kein 5-fach-Fetch), das Ticket-Paging (`?cursor=`) behält den Tab.
  Reihenfolge: Offene / Abgeschlossene Tickets / Kontakte / Geräte / Verträge.
  - **Tickets:** gemeinsame `TicketsList` (companyID + status-Filter), Firma-Spalte
    ausgeblendet (neuer `columns.company:false`-Schalter), `assigned`-Spalte an. Offen
    (status≠5) und Abgeschlossen (status=5) je gepaged. TicketsList-Wrapper auf
    `overflow-x-auto` umgestellt (vorher `overflow-hidden`) – lange Titel werden nicht
    mehr abgeschnitten, betrifft alle Listenseiten (rein additiv).
  - **Kontakte/Geräte/Verträge:** neue Row-Helper `contacts.rowsByCompany`,
    `configurationItems.rowsByCompany`, `contracts.rowsByCompany` (firmengefiltert).
    Verträge-`status` (verifiziert: **0 = Inaktiv, 1 = Aktiv**) als Badge; Zeitraum =
    `startDate – endDate`.
- **Verifiziert gegen `.env.local` + Browser (Beispielfirma, companyID 222):** Offen **24**,
  Abgeschlossen **5877** (gepaged), Kontakte ~90 (anonymisiert…), Geräte
  (referenceTitle/serialNumber/location), Verträge (Managed Service Beispielfirma … Aktiv/Inaktiv).
  Leerer Tab: **5GAA (309)** Geräte = 0 → Empty-State „Keine Geräte". „Neues Ticket für
  diese Firma" öffnet den Dialog mit **Firma vorbefüllt** (5GAA) und **gefiltertem
  Kontakt-Picker** (nur „Patrick Kapuscik"); Queue-Default „Level I-Support". **Kein
  Test-Ticket angelegt** (5GAA ist eine echte Firma – Dialog nur geprüft, nicht
  abgesendet). Build grün; Hell + Dunkel + Mobile (`docs/visual-refresh/B3/`).

### [2026-06-04] B4 umgesetzt – Kontaktliste (/contacts) + Kontaktdetail (/contacts/[id])
- **Liste:** `contacts.searchRows(query?, limit=100)` (erste Seite ODER OR-Gruppe
  `firstName/lastName contains`, isActive) + `contact-list.ts#getContactsList`
  (Firmenname gebündelt via `companies.namesByIds`, kein N+1). Server sortiert nicht
  (B13) → Sortierung clientseitig. `ContactsTable` (Client): erste Seite vom Server,
  beim Tippen **debounced** `GET /api/contacts/search?q=`, Spalten Name/Firma/E-Mail/
  Telefon, Zeilenklick → Kontaktseite. `table-fixed` + `min-w-2xl` (Desktop passt,
  Mobile scrollt).
- **Detail:** `contacts.get(id)` → Name (h1) + Titel; Kopf-Card mit **Link zur Firma**
  (`/companies/[companyID]`, Name aufgelöst), E-Mail, Telefon, Mobil. Darunter
  **URL-gesteuerte Tabs** (neue, wiederverwendbare `UrlTabs`-Komponente): Offene /
  Abgeschlossene Tickets des Kontakts (`contactID`-Filter, gemeinsame `TicketsList`,
  Firma-Spalte aus, gepaged).
- **Verifiziert gegen `.env.local` + Browser:** Liste „100 Kontakte" (Firmennamen
  aufgelöst). Suche „Demo" → **9 Treffer** inkl. **Demo Agent** (SSIG Sandbox).
  Kontakt **Beispielkontakt (30682924, Beispielfirma)** → Detail zeigt Firmenlink Beispielfirma + offenes
  Ticket **T20220517.0009** (Status „In Bearbeitung"). Build grün; Hell + Dunkel +
  Mobile (`docs/visual-refresh/B4/`).

### [2026-06-04] B1 umgesetzt – Sidebar: Nav „Firmen" + „Kontakte"
- `components/app-sidebar.tsx`: zwei Nav-Punkte ergänzt – **Firmen** (`/companies`,
  `Building2Icon`) und **Kontakte** (`/contacts`, `ContactIcon`), eingeordnet nach
  „Teamtickets", vor „Meine Zeiten". Aktiv-Zustand über das bestehende
  `isActiveRoute` (startsWith) – z. B. auch auf der Kundenakte `/companies/[id]`.
- Verifiziert (Browser): Firmen/Kontakte sichtbar, Aktiv-Pille auf `/companies`,
  Mobile-Sheet zeigt beide Punkte. Hell + Dunkel + Mobile (`docs/visual-refresh/B1/`).

### [2026-06-04] C1 umgesetzt – Schnellsuche gruppiert (Command-Palette/Header)
- `components/command-palette.tsx`: bei Eingabe **drei parallele, je auf 5 begrenzte,
  debounced** Abfragen → Sektionen **Tickets / Firmen / Kontakte** (`/api/tickets/search`,
  `/api/companies?q=`, `/api/contacts/search`). Leere Sektionen werden ausgeblendet.
  Navigation: Ticket → `/tickets/[id]`, Firma → `/companies/[id]` (Kundenakte), Kontakt
  → `/contacts/[id]`. Firmen/Kontakte zusätzlich in der Navigations-Liste. Header-Suche
  unverändert (öffnet dieselbe Palette).
- **Verifiziert (Browser):** „Demo" → Sektionen Tickets (5) + Kontakte (5; Demo
  Demo Agent fällt durch das 5er-Limit raus → erscheint in der vollen /search-Liste, C2),
  keine Firmen-Sektion (kein Firmenname „Demo"). „Beispielfirma" → alle drei Sektionen (Tickets
  5, Firma „Beispielfirma…", Kontakte 5); Klick auf die Firma navigiert in die Kundenakte
  (`/companies/222`). Build grün; Hell + Dunkel + Mobile (`docs/visual-refresh/C1/`).

## 2026-06-04 — Folge-Feedback Paul (Tabellen/Suche/Filter)

### [2026-06-04] FB1 umgesetzt – Firmenliste: Kundenart-Filter (Default „Kunde")
- **`companyType`-Picklist verifiziert (`.env.local`):** 1=Customer, 2=Lead,
  3=Prospect, 4=Dead, 6=Cancellation, 7=Vendor, 8=Partner. Deutsche Labels in
  `lib/autotask/company-types.ts` (Kunde/Lead/Interessent/Inaktiv/Kündigung/
  Lieferant/Partner). `companies.listActive` lädt jetzt zusätzlich `companyType`.
- **`CompaniesTable`:** neuer **Kundenart-Select** (Default **„Kunde"**, aktiv) +
  neue **sortierbare Spalte „Kundenart"**. Filter wirkt clientseitig über den voll
  geladenen Datensatz (kein Refetch beim Umschalten). Tabelle `min-w-3xl table-fixed`.
- **Verifiziert (Browser):** Default „Kunde" → **99 von 637**; „Alle Arten" → 637 mit
  gemischten Arten (Kunde/Lead/Lieferant/Kündigung …). Build grün; Hell + Dunkel +
  Mobile (`docs/visual-refresh/FB/`).

### [2026-06-04] FB2 umgesetzt – Kontaktliste: Filter nach Firma
- `contacts.searchRows(query?, companyId?, limit=200)` + `getContactsList(query?,
  companyId?)` + `GET /api/contacts/search?q=&companyId=` (companyId 0 = Sandbox sauber
  behandelt, kein NaN→0-Bug). `ContactsTable`: zusätzliche **Firma-Combobox** (async
  Firmensuche wie im Neues-Ticket-Dialog, + „Alle Firmen"); Auswahl lädt server-seitig
  alle Kontakte der Firma. Name-Suche + Firma-Filter kombinierbar.
- **Verifiziert (Browser):** Firma „Beispielfirma" gewählt → **92 Kontakte**, alle Beispielfirma. Build
  grün; Hell + Dunkel + Mobile (`docs/visual-refresh/FB/`).

### [2026-06-04] FB3 umgesetzt – Suche in jeder Ticketansicht
- **`TicketsList`** bekam ein Suchfeld (Nummer/Titel) + Prop **`searchMode`**:
  „server" (Default) = Sofort-Clientfilter der aktuellen Seite **plus** debounced
  `?q=` (die Seite mischt `ticketSearchFilter(q)` ein → volle, seitenübergreifende
  Suche, Tab/Filter bleiben erhalten); „client" = nur Clientfilter (kuratierte
  Einzellisten); „off" = kein Feld. Neuer Helper `ticketSearchFilter(q)`
  (OR-Gruppe `ticketNumber|title contains`).
- **Verdrahtung:** Server-Suche in Meine/Team/Kundenakte-Ticket-Tabs/Kontakt-Tabs
  (q in den jeweiligen Filter gemischt; bei Team vor dem No-Op-Guard). „client" für
  die Dashboard-Drilldowns *Zusätzlicher Mitarbeiter* + *Ball liegt bei mir*. „off"
  für die Dashboard-Fokusliste und die eigene `/search`-Seite.
- **Tabellen-Politur (Teil von FB4):** `TicketsList`-Tabelle auf `min-w-3xl` +
  feste Spaltenbreiten (Nummer/Status/Priorität/Fällig) und **umbrechende** Titel-/
  Firma-Zellen → passt am Desktop ohne Abschneiden, scrollt sauber am Handy.
- **Verifiziert (Browser):** `/tickets/my` „Jahresgespräch" → nur passende Tickets
  (`?q=` gesetzt, Eingabe-Fokus erhalten). Kundenakte Beispielfirma `tab=offen` „Firewall" →
  3 Treffer, **Tab bleibt erhalten** (`?tab=offen&q=Firewall`). Build grün; Hell +
  Dunkel + Mobile (`docs/visual-refresh/FB/`).

### [2026-06-04] FB4 umgesetzt – Tabellen vereinheitlicht + voll responsiv
- **Einheitliches Tabellen-Muster** überall: Wrapper `overflow-x-auto rounded-lg
  border` + Tabelle mit `min-w-*` (passt am Desktop, scrollt sauber am Handy statt zu
  quetschen/abzuschneiden) + umbrechende Text-Zellen (Name/Titel/Firma) und feste
  Breiten für schmale Spalten.
- **Betroffen (über FB3/FB4):** `TicketsList` (`min-w-3xl`, Spaltenbreiten, Titel/
  Firma umbrechend), `CompaniesTable` (`table-fixed min-w-3xl`), `ContactsTable`
  (`table-fixed min-w-2xl`), Kundenakte-Tab-Tabellen (Kontakte/Geräte/Verträge,
  `min-w-2xl`), „Meine Zeiten" (`overflow-x-auto` + `min-w-2xl`). Filter-/Suchleisten
  brechen mit `flex-wrap` um; Suchfeld geht am Handy auf volle Breite.
- **Verifiziert (Browser, Mobile):** Firmen/Kontakte/Tickets/Meine-Zeiten scrollen
  horizontal ohne Überlappung; Karten stapeln. Build grün (`docs/visual-refresh/FB/`).

### [2026-06-04] C2 umgesetzt – /search Ergebnisseite mit Scope-Tabs
- `/search?q=&scope=tickets|firmen|kontakte` (Default `tickets`). **Scope-Tabs** über
  `UrlTabs` (param `scope`); `UrlTabs` erhält jetzt übrige Parameter (insb. **`q`**)
  beim Tabwechsel (nur `cursor` wird verworfen). `SearchBox` behält den aktiven Scope
  beim erneuten Suchen.
- **Pro Scope volle Listen:** Tickets = `searchTickets` (bisher), Firmen =
  `companies.searchRows(q)` (companyName contains, Ort, Top 50) → `CompanyResults`
  (Klick → Kundenakte), Kontakte = `getContactsList(q)` → `ContactResults`
  (Name/Firma/E-Mail/Telefon, Klick → Kontaktseite). Saubere Empty-/Error-States je
  Scope; gleiches responsives Tabellen-Muster.
- **Verifiziert (Browser):** „Demo" → Tickets (Demo-Tickets), Kontakte **volle 9
  inkl. Demo Agent** (Quick-Palette zeigt nur 5), Firmen „Keine Treffer";
  Scope-Wechsel behält `?q=` (`?q=Demo&scope=kontakte`). „Beispielfirma" → Firmen-Scope listet
  „Beispielfirma … Westerheim". Build grün; Hell + Dunkel + Mobile (`docs/visual-refresh/C2/`).

### [2026-06-04] FB5 umgesetzt – Suche in JEDER Liste + smartere Spaltenbreiten (Paul)
- **Suche überall:** Neue wiederverwendbare `SearchableTable` (Client) – Suchfeld +
  clientseitiger Filter über vollständig geladene Listen. Eingesetzt in den
  Kundenakte-Tabs **Kontakte/Geräte/Verträge** (`kundenakte-panels.tsx`) und in
  **„Meine Zeiten"** (`zeiten-table.tsx`). Ticket-Listen hatten die Suche schon (FB3).
- **Smartere Spaltenbreiten:** Tabellen von `table-fixed` + harten px-Breiten auf
  **automatisches Layout** umgestellt (Spalten passen sich dem Inhalt an, Textspalten
  umbrechen, `min-w-*` fürs Scrollen am Handy). Betrifft `SearchableTable`,
  `CompaniesTable`, `ContactsTable`, `TicketsList`, die /search-Ergebnistabellen.
  → Name/Titel bekommen den Platz, schmale Spalten bleiben kompakt; kein
  Desktop-Scrollbalken (Firmen 959=959, Geräte 959=959 verifiziert).
- **Verifiziert (Browser):** Kundenakte Kontakte „Demo" → 1 Treffer; Geräte-Tab hat
  Suchfeld + passt; „Meine Zeiten" hat Suchfeld; Firmen/Geräte ohne Überlauf. Build
  grün; Hell + Dunkel + Mobile (`docs/visual-refresh/FB/`).

### [2026-06-04] FB6 umgesetzt – Kundenakte-Kopf: zwei Karten (Paul-Wahl)
- **Hinweis:** die „weiße Box" ist eine shadcn-`Card` (`bg-card`-Token, wie die
  Dashboard-Kacheln). Paul fand die eine breite Karte zu leer. Gewählte Variante:
  **Stammdaten-Karte + Überblick-Karte nebeneinander** (`grid md:grid-cols-2`, am
  Handy gestapelt).
- **Links:** Stammdaten (Adresse/Telefon/Web) wie bisher. **Rechts:** Kennzahlen-Karte
  mit **anklickbaren** Werten (führen in den jeweiligen Tab): Offene/Abgeschlossene
  Tickets, Kontakte, Geräte, Verträge. Daten: `getCompanyStats(companyId)` – fünf
  parallele Count-Abfragen (Count-Endpoint); Fehler tolerant (Werte „—").
- **Verifiziert (Browser, Beispielfirma 222):** Offene **24**, Abgeschlossen **5877**, Kontakte
  **92**, Geräte **271**, Verträge **26** – alle gegen den Count-Endpoint geprüft
  (MATCH). Klick „Geräte" → `?tab=geraete`. Build grün; Hell + Dunkel + Mobile
  (`docs/visual-refresh/FB/kundenakte-head-2cards-*`).

### [2026-06-04] FB7 umgesetzt – Kundenakte-Kopf final (ersetzt FB6-Layout)
- Die zwei Kopf-Karten (FB6) wirkten halbleer → **entfernt**. Stattdessen:
  - **Stammdaten ohne Box:** Adresse/Telefon/Web als ruhige Kopfzeile direkt unter der
    h1 (lucide-Icon + `text-muted-foreground`, `flex-wrap`, kein Card-Rahmen).
  - **Kennzahlen = 5 KPI-Kacheln** über die volle Breite, im **exakt gleichen Muster
    wie die Dashboard-KPI-Karten** (`StatCard` = Link→Card, `CardDescription` + große
    `CardTitle` 3xl + `CardAction`-Icon, gleiche Hover-/Höhe-Logik): Offene Tickets /
    Abgeschlossen / Kontakte / Geräte / Verträge. Jede Kachel klickbar → Tab. Grid
    `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5`.
  - Daten unverändert aus `getCompanyStats` (FB6). Nur shadcn/Tokens/Standard-Tailwind.
- **Verifiziert (Beispielfirma 222):** 24/5877/92/271/26; Klick „Geräte" → `?tab=geraete`. Build
  grün; Hell (5 in einer Reihe) + Dunkel + Mobile (gestapelt) –
  `docs/visual-refresh/FB/kundenakte-head-kpis-*`.

### [2026-06-04] BULK — Mehrfachauswahl + Bulk-Aktionen in den Ticketlisten
- **Kein neuer Schreibpfad.** Jede Bulk-Aktion ruft pro Ticket das bestehende
  `PATCH /api/tickets/[id]` (Whitelist B15b) auf. Keine neue Route, kein neuer
  Autotask-Schreibzugriff.
- **Auswahl** in der gemeinsamen `TicketsList` über Prop `selectable` (+ `resources`
  + `myResourceId`). AN: Meine Tickets, Teamtickets, Kundenakte- und Kontakt-Ticket-
  Tabs. AUS (Default): Dashboard-Minilisten, Such-Ergebnisliste, Neben-/Ball-Liste.
  shadcn `Checkbox`: Kopf-Checkbox wählt/leert alle sichtbaren Zeilen, Zeilen-Checkbox
  einzeln. Auswahl gilt pro Seite und **leert bei Seiten-/Filterwechsel** (Effekt auf
  `pageKey = ids.join()` → neue Serverdaten ⇒ Auswahl zurück). Checkbox-Zelle stoppt
  die Row-Navigation (`stopPropagation`).
- **Bulk-Leiste ERSETZT die Filterzeile** (gleiche Position, gleiche Höhe – bare
  `flex flex-wrap`, KEINE eigene Box), statt eine neue Zeile einzuschieben. Grund:
  Paul-Feedback – die zuvor zusätzlich eingeschobene Leiste ließ die Tabelle nach
  unten rutschen. Jetzt morpht die Zeile an Ort und Stelle, die Tabelle bleibt stehen.
- **Aktionen:** Status / Priorität / Queue (je `Select` aus der Picklist – „Abschließen"
  = Status 5 inklusive); **Zuweisen** (Resource-Combobox) + **Mir zuweisen**, jeweils
  mit **gekoppelter Rolle** wie B15b (1 Rolle → automatisch, mehrere → Rollen-Auswahl
  im Popover, dann senden); „Auswahl aufheben".
  - **Bugfix während der Verifikation:** Bei „Mir zuweisen" mit mehreren Rollen wurde
    die Rollen-Auswahl im (geschlossenen) Popover gerendert → unsichtbar. Fix: im
    Mehr-Rollen-Fall `setAssignOpen(true)`, damit die Auswahl auch ohne vorher
    geöffnetes Popover erscheint.
- **Ausführung:** Bestätigungs-Dialog (`AlertDialog`, „N Tickets … ?"), dann PATCHes
  mit Limiter **max. 3 parallel** (kleiner Pool), Fortschritt sichtbar („x/N",
  `Progress`). **Teilfehler brechen NICHT ab:** je Ticket try/catch, Ergebnisse werden
  gesammelt → Zusammenfassung „N erfolgreich[, M fehlgeschlagen]" + Liste der
  fehlgeschlagenen Ticketnummern mit Fehlertext. Erfolg → Toast + `router.refresh()` +
  Auswahl leeren.
- **Resources** für die Zuweisung: neue, 5 min gecachte `getAssignableResources()`
  (`unstable_cache`) statt pro Liste neu zu laden.
- **Verifiziert (NUR an den ZZZ-Testtickets, IDs 43180–43183, Firma „SSIG-IT GmbH
  Sandbox"):**
  - Kopf-Checkbox wählt die ganze Seite (4 Tickets), Bulk-Leiste zeigt „4 … ausgewählt".
  - Bulk-Status **In Bearbeitung** (3 Tickets 43181–43183) → „3 erfolgreich", Liste nach
    `refresh` auf „In Bearbeitung"; **zurück** auf **Abgeschlossen** → „3 erfolgreich",
    Ausgangszustand wieder hergestellt.
  - **Mir zuweisen** (Demo Teamlead, 5 Rollen → Rollen-Auswahl „Netzwerk-Administrator")
    → „3 erfolgreich", Spalte „Zugewiesen" = Demo Teamlead; **zurück** = wieder nicht
    zugewiesen (PATCH `assignedResourceID/RoleID = null`).
  - Auswahl leert nach Ausführung; Tabelle rutscht beim Markieren **nicht** mehr.
  - Build grün; `npm run test:e2e` 10/10 grün; Hell + Dunkel + Mobile (Bulk-Leiste
    bricht mobil sauber um, kein Überlauf) – `docs/visual-refresh/bulk/*`.
- **Offen/ehrlich:** Eine echte **Teil-Fehlschlag**-Situation ließ sich an den
  Sandbox-Testtickets nicht deterministisch erzwingen (alle PATCHes erfolgreich); die
  Zusammenfassung erschien bei jedem Lauf, der Fehlerlisten-Pfad ist implementiert
  (per-Ticket try/catch + Sammeln), aber nicht live mit einem echten Fehler bebildert.

### [2026-06-04] BULK-Feedback — kein Springen, breitere Dropdowns, Undo
Paul-Korrekturen an der Bulk-Leiste:
- **In-Place-Swap OHNE Pixel-Sprung.** Paul will, dass sich die OBERSTE Zeile beim
  Markieren austauscht (Filter → Bulk-Leiste), aber sich dabei NICHTS bewegt. Zuerst als
  schwebende Leiste gelöst – Paul wollte aber den Tausch oben. Finale Lösung: Filterzeile
  und Bulk-Leiste liegen in EINER Grid-Zelle übereinander (`grid` + beide
  `col-start-1 row-start-1`); die jeweils inaktive bleibt mit `invisible` im Layout
  stehen. Dadurch ist die Slot-Höhe = max(Filter, Leiste) und damit KONSTANT – beim
  Markieren springt nichts. Gemessen: Tabellen-Oberkante identisch (Teamtickets 253↔253,
  Kundenakte-Tab 469↔469, mit/ohne Auswahl). Die Bulk-Leiste ist dafür wieder inline
  (bare `flex flex-wrap`, keine eigene Box).
- **Dropdown-Werte nicht mehr abgeschnitten.** Das shadcn-`SelectContent` ist per Default
  `w-(--anchor-width)` (= schmale Trigger-Breite) + `overflow-x-hidden` → lange
  Status-Labels („Warten auf Kundenreaktion") wurden geklippt. Fix: in der Bulk-Leiste
  `SelectContent className="w-auto min-w-52"` → Dropdown wächst auf Inhaltsbreite.
- **Undo der letzten Bulk-Aktion.** Vor der Aktion werden die alten Feldwerte je Ticket
  geschnappschusst (TicketsList reicht `status/priority/queueID/assignedResourceID/RoleID`
  durch; dafür `assignedResourceRoleID` in `TICKET_FIELDS` ergänzt). Nach Erfolg gibt es
  **„Rückgängig"** (a) als Button im Ergebnis-Dialog und (b) als Aktion im Erfolgs-Toast
  (8 s) – der Toast funktioniert auch noch, wenn die Leiste schon ausgeblendet ist
  (`undoBatch` ist bewusst zustandslos). Undo setzt jedes Ticket auf SEINEN alten Wert
  zurück (gekoppelte Zuweisung Resource+Rolle inkl. null = „nicht zugewiesen").
- **Verifiziert (ZZZ 43180–43183):** 4 Tickets → Status „Warten auf Kundenreaktion" → „4
  erfolgreich" → **Rückgängig** → jedes Ticket auf SEINEN Ausgangswert zurück (43180
  status 8 + Demo Teamlead, 43181–43183 status 5 + nicht zugewiesen, per API gegengeprüft).
  Dropdown zeigt alle Labels voll; Tabelle bewegt sich beim Markieren nicht (Hell/Dunkel/
  Mobile, Leiste bricht mobil sauber um). Build + e2e 10/10 grün.
  Screenshots `docs/visual-refresh/bulk/*` (floating/dropdown/undo).
- **Hinweis „protokolliert":** Umgesetzt als **Ein-Schritt-Undo der letzten Aktion**
  (deckt „ich habe 25 Tickets falsch geändert" ab). Ein dauerhaftes Änderungs-Protokoll
  (Historie über mehrere Aktionen/Sessions) ist NICHT gebaut – bei Bedarf separat.

### [2026-06-04] Tabellen — Spaltenbreiten gedeckelt + Truncate mit Hover-Tooltip
Paul-Feedback: lange Werte sollen eine Spalte nicht „so lang" aufblähen; zu lange
Titel abschneiden und beim Hover sofort den vollen Text zeigen.
- Neue Komponente `components/truncated-text.tsx`: einzeiliger `truncate`-Text; misst per
  `ResizeObserver`, ob abgeschnitten, und zeigt nur DANN beim Hover den vollen Text als
  `Tooltip` (globaler `TooltipProvider` im Layout hat delay 0 → „sofort").
- Strategie: weiter **automatisches** Tabellen-Layout (responsive), aber Textspalten
  mit `max-w-*` gedeckelt (Standard-Tailwind, kein `[..]`). Dadurch wächst die Spalte
  bis zum Cap und schneidet längere Werte ab – statt wie bisher umzubrechen/zu wuchern.
  Caps: Ticket-Titel `max-w-md`, Firma/Queue/Zugewiesen `max-w-44/36/40`, Firmen-/
  Kontakt-Name `max-w-xs`, E-Mail/Standort/Seriennummer entsprechend.
- Umgesetzt in: TicketsList, Firmen-Tabelle, Kontakt-Tabelle, Kundenakte-Panels
  (Kontakte/Geräte/Verträge), „Meine Zeiten".
- Verifiziert: Teamtickets (Firma kappt bei 176 px, Tooltip „Beispielfirma Metall- …" beim
  Hover), Firmenliste (Name kappt bei 320 px, lange Namen abgeschnitten). Build +
  e2e 10/10 grün.

### [2026-06-04] Globale Suche — Spotlight-Stil mit 4 parallelen Spalten
Paul-Vorgabe: Suchleiste größer (macOS-Spotlight), Ergebnisse direkt in vier Spalten
(Firma, Kontakte, Ticket-Name, Ticket-Nummer), gleichzeitig gesucht, Rate-Limits beachten.
- `CommandPalette` neu als Spotlight-Dialog (eigenes `Dialog` statt cmdk-Liste): große
  Suchleiste (`h-14 text-base`) oben, darunter VIER Spalten. Leere Eingabe → „Springen
  zu"-Launcher (Navigation). Mobile: Spalten stapeln (`grid-cols-1 … lg:grid-cols-4`).
- Vier parallele, debounced (300 ms) Abfragen. Tickets als ZWEI feldbegrenzte Suchen
  über `scope=name|number` am bestehenden `/api/tickets/search` (neue `quickTicketSearch`
  – nur title/ticketNumber, OHNE Firmennamen-Auflösung → spart Companies-Calls). Die 2
  Tickets-Abfragen auf dieselbe Tabelle hält der Client-Limiter (max. 2/Entität) unter
  dem Autotask-Thread-Limit; Firma=1 Companies-, Kontakt=1 Contacts-Call. Je Spalte max. 8.
- Enter öffnet die vollständige Suche (`/search?q=`); Klick auf ein Ergebnis navigiert.
- Verifiziert: „Firewall" → nur Ticket-Name; „Beispielfirma" → Firma+Kontakte+Ticket-Name parallel;
  Klick Firma → `/companies/222`. Hell + Dunkel + Mobile. e2e-Smoke (Palette) auf das
  neue DOM angepasst; Build + 10/10 grün.

### [2026-06-04] Spalten per Drag & Drop umsortierbar (jede Tabelle, persistent)
Paul-Vorgabe: in jeder Tabelle die Spalten per Drag & Drop selbst positionieren.
- Neuer Hook `hooks/use-column-order.ts`: native HTML5-DnD (KEINE Fremd-Library),
  Reihenfolge pro Tabelle in localStorage (`storageKey`). Beim Laden mit den aktuellen
  Spalten versöhnt (neue hinten angehängt, entfernte ignoriert) – kein Hydration-Mismatch
  (localStorage erst im Effect). `headProps(id)` liefert `draggable` + DnD-Handler +
  `data-dragging`/`data-dragover` fürs Hover-Feedback. `reset()` + `customized` für den
  „Spalten zurücksetzen"-Button.
- Angewendet auf ALLE Tabellen:
  - SearchableTable (Kundenakte Kontakte/Geräte/Verträge + Meine Zeiten) – je eigener Key.
  - TicketsList – Key pro Spaltensatz (`cols:tickets:<ids>`); Checkbox-Spalte bleibt fest
    vorne und ist NICHT umsortierbar.
  - Firmen- + Kontakt-Tabelle – Sort-Header bleiben klickbar (Sortieren) UND ziehbar
    (Reorder): der Button im Header sortiert, das umgebende `TableHead` ist `draggable`.
- „Spalten zurücksetzen" erscheint je Tabelle, sobald eine eigene Reihenfolge gespeichert
  ist, und stellt den Standard wieder her.
- Verifiziert (echtes Drag im Browser): Kundenakte-Kontakte (Name↔Telefon getauscht, nach
  Reload erhalten, Body mit) und Teamtickets (Spalte verschoben + persistiert + Body
  synchron + Reset). Firmen-/Kontakt-Tabelle nutzen denselben Hook (Build grün, nicht
  separat interaktiv gedragt). Build + e2e 10/10 grün.
- Bewusste Grenze (kein Overengineering): native DnD ist nicht tastaturbedienbar; für ein
  internes Werkzeug akzeptiert, dafür keine zusätzliche Abhängigkeit.

### [2026-06-04] Suche responsiv — geteilte 4-Spalten-Komponente (Palette + /search)
Paul-Feedback: Spalten in der Spotlight-Palette zu schmal; die Enter-Seite (/search) soll
ebenfalls 4 Spalten zeigen; alles durchgängig responsiv für jede Bildschirmgröße.
- Geteilte Komponente `components/search/result-column.tsx`: `ResultColumn` (Header mit
  Icon + Trefferzahl; Zeilen als Button [Palette: `onSelect` schließt den Dialog] ODER
  als `<Link>` [Seite]) + `ResultGrid` (responsives Raster). **Icon wird als fertig
  gerendertes Element übergeben, NICHT als Komponente** – sonst „Only plain objects can be
  passed to Client Components" (Server→Client). Genutzt von Palette UND /search → identisch.
- **Responsives Konzept (überall gleich):** `grid-cols-1` (mobil) → `sm:grid-cols-2`
  (≥640) → `xl:grid-cols-4` (≥1280). 4 Spalten erst bei genug Breite, sonst 2, mobil
  gestapelt → Spalten nie zu schmal.
- **Palette:** Dialog wächst mit (`sm:max-w-2xl lg:max-w-4xl xl:max-w-6xl`); bei xl vier
  breite Spalten statt vier gequetschter. `dense` = `max-h-96` + Scroll.
- **/search-Seite komplett neu:** keine Scope-Tabs mehr, sondern dieselben 4 Spalten
  (volle Trefferlisten, je 30). Vier parallele Server-Abfragen (Tickets 2× via
  `quickTicketSearch` title/ticketNumber, Firma `companies.searchRows`, Kontakt
  `getContactsList`) – Client-Limiter (max 2/Entität) hält das Thread-Limit ein.
  Suchleiste größer (`h-12 text-base`). Ungenutzte `search-results.tsx` entfernt.
- Verifiziert (Browser): /search UND Palette je bei 1440 (4 Sp), ~820–900 (2 Sp), 390
  (1 Sp, gestapelt) – überall lesbar, kein Überlauf. Build + e2e 10/10 grün.

### [2026-06-04] Skeletons spiegeln das echte Raster (überall)
Paul-Feedback: die Loading-Skeletons passen nicht zum tatsächlichen Raster der Inhalte.
- Neues Kit `components/skeletons.tsx`: `PageHeaderSkeleton`, `FiltersSkeleton`,
  `TableSkeleton` (ECHTE Table-Struktur: `overflow-x-auto`+Border, Kopf-/Datenzeilen,
  optional Auswahl-Spalte, `min-w-*` wie real → Spalten/Zeilen im selben Raster),
  `KpiTilesSkeleton` (Karten-Raster wie Dashboard/Kundenakte), `ChartCardSkeleton`.
- Vorhandene loading.tsx an das echte Layout angepasst: Dashboard (KPIs + Diagramm +
  „Zuletzt bearbeitet"-Tabelle), Meine Tickets, Meine Zeiten, Ticketdetail.
- Fehlende loading.tsx ergänzt (vorher leer): Firmen, Kontakte, Teamtickets, Nebentickets,
  Ball, Suche (4-Spalten-Raster), Kundenakte (`companies/[id]`), Kontaktdetail.
- Grundsatz: Skeletons nutzen DIESELBEN Bausteine (`Table`, Card-Maße, dieselben Grid-/
  `min-w`-Klassen) wie der echte Inhalt → Raster deckungsgleich per Konstruktion. Build +
  e2e 10/10 grün. (Der Sub-Sekunden-Ladezustand ließ sich in der Dev-Umgebung nicht
  zuverlässig abfilmen; Korrektheit folgt aus der Wiederverwendung der echten Komponenten.)

### [2026-06-04] /search — Paginierung pro Spalte („Mehr laden") + Gesamtzahl
Paul: bei „000" gibt es hunderte Treffer; die Spalten deckelten bei 30 – man will alle
sehen bzw. eine Paginierung.
- **Cursor-Paginierung pro Spalte über OPAKES Token.** Neue `autotask.queryPageToken<T>`
  liefert statt der vollen Autotask-Next-URL nur den Pfad NACH der Basis-URL als Token; die
  Basis-URL bleibt server-seitig (SSRF-Prüfung aus `queryPage` greift weiter). Belegt: das an
  `/api/search` gesendete Token ist `Tickets/query/next?paging=…` – KEINE Autotask-Basis-URL
  im Browser (Regel „Base-URL/Creds nie zum Client" eingehalten).
- `searchColumnPage(kind,q,token)` (search.ts): eine Seite (25) je Spalte + Gesamtzahl
  (count-Endpoint, nur auf der ERSTEN Seite). `/api/search?kind=&q=&token=` lädt Folgeseiten.
- `/search`: erste Seite je Spalte server-seitig (4 parallel, Client-Limiter hält das
  Thread-Limit), dann Client-Komponente `SearchColumns` mit „Mehr laden" je Spalte
  (unabhängig, hängt an, Kopf zeigt „x / Gesamt").
- Verifiziert „000": Ticket-Name 25/435, Ticket-Nummer 25/11784; „Mehr laden" → 50/435
  (nur die geklickte Spalte wächst, andere unverändert). Build + e2e 10/10 grün.

### [2026-06-05] B17-DISCOVERY + Chat-Inbound-Fix + Notify-Schalter
Lese-Bestandsaufnahme für B17/B17a in **`docs/B17-DISCOVERY.md`** (Quelle: App-Sandbox
über `.env.local`, read-only; NICHT MCP). Kernbefunde + daraus gezogener Sofort-Slice:

- **Inbound ≠ 101 (mandantenweit belegt).** In 209.639 TicketNotes gibt es **0** vom
  `noteType 101`. Echte Kundenantworten sind **`noteType 3` (Aufgabennotizen) +
  gesetztes `createdByContactID`** (2.715 kunden-erstellte Typ-3-Notizen; 976 mit
  Mail-Antwort-Präfix „AW:"). `noteType 3` ist gemischt (1.389 intern) → zuverlässiger
  Inbound-Diskriminator = **`createdByContactID` gesetzt**, nicht der noteType.
- **Threading-Token** in Autotask-Mails = **`[Ticket#<16 Ziffern>]`** (Autotask-generiert,
  NICHT die Ticketnummer) → von außen nicht reproduzierbar. **Mailbox-Adresse + Workflow-
  Regel sind per REST nicht auslesbar** (404). UDF „Kunde benachrichtigen" existiert real
  (Picklist `Ja|Nein`, verifiziert via `Tickets/entityInformation/userDefinedFields`).

**Code-Änderung 1 — Chat-Inbound reparieren** (`entities/ticket-notes.ts`): `byTicketTypes`
→ **`byTicketConversation`**. Filter jetzt `ticketID == X` UND **OR-Gruppe**
`(noteType in [18,101])` ODER `(createdByContactID exist)`. Holt damit auch die als
`noteType 3` ankommenden Kundenantworten; interne Resource-Notizen (Typ 1/2/3 OHNE Kontakt)
bleiben ausgeschlossen. `directionOf()` unverändert (createdByContactID → inbound).
Caller in `entities/ticket-chat.ts` angepasst.

**Code-Änderung 2 — Notify-Schalter** (`components/tickets/ticket-chat.tsx`): shadcn
`Switch` + `Label` „Kunde per E-Mail benachrichtigen" (Default AN), steuert den schon
vorhandenen `notify`-Parameter der Route (vorher hartkodiert `true`). **Sende-Pfad sonst
unverändert** (UDF Ja/Nein, kein Resend in diesem Slice).

**Verifiziert (2026-06-05):**
- `npm run build` grün.
- Browser, **historisches Ticket 11807** (Demo Teamlead, Mock): `/api/tickets/11807/chat`
  liefert jetzt **2 Inbound-Notizen `noteType 3`** (Sender „Hubert Rauschmaier",
  chronologisch); interne Notizen (Typ 1/2/13) erscheinen NICHT im Chat. Screenshots
  Hell + Dunkel + Mobile (Chat im Mobile-Layout im Collapsible „Kontext & Chat").
- Browser, **Testticket 43180** (Schreibtest erlaubt): UDF vorab via Helper auf „Ja"
  gesetzt → Schalter AUS → Senden „ZZZ TEST B17a notify-off". Netz-Request-Body
  `{"text":"…","notify":false}` (HTTP 200), danach UDF **„Ja" → „Nein"** (per API gelesen).
  Keine Mail (endet „Nein"; 43180 = Sandbox-Catch-all `qalab@autotask.com`).

**B17a-Status präzisiert:** Inbound-noteType ist damit **aus Daten geklärt** (= 3 +
`createdByContactID`, 101 widerlegt). **Offen für Prod** bleibt **nur noch die
Threading-Frage**: threadet eine Antwort auf eine selbst (Resend) versendete Mail ohne
den Autotask-`[Ticket#…]`-Token? Mailbox-Adresse (Reply-To) + Workflow-Regel-Deaktivierung
sind Paul-Punkte (siehe B17-DISCOVERY §5). Throwaway-Probe-/Helper-Skripte nach Lauf
entfernt; keine Autotask-Daten außer dem 43180-Schreibtest verändert.

### [2026-06-05] B17 — Resend-only, kein Notify-Toggle, Threading via Ticketnummer im Betreff
Folgeentscheidungen von Paul (überschreiben Teile der B17-DISCOVERY-Skizze):
- **Resend ist der EINZIGE Versandweg** der Chat-Kundenmail. **Kein `MAIL_PROVIDER`-
  Flag**, kein Autotask-Workflow-Fallback. Der zwischenzeitliche `MAIL_PROVIDER`-
  Platzhalter wurde wieder aus `.env.example`/`.env.local`/`DEPLOY.md` entfernt;
  verbleibend nur `RESEND_API_KEY`, `RESEND_FROM`, `AUTOTASK_INBOUND_MAILBOX`.
- **Notify-Schalter wieder aus der Chat-UI entfernt** (`ticket-chat.tsx`): eine
  Chat-Nachricht IST die Kundenmail; interne Vermerke laufen über die separate interne
  Notiz (noteType 2). Sende-Body wieder `notify:true` (bis B17 den Resend-Pfad baut).
  Der Inbound-Fix (`byTicketConversation`) BLEIBT.
- **Threading geklärt (Paul):** Steht die **Ticketnummer im Betreff**, landet die Antwort
  wieder am Ticket — der Autotask-`[Ticket#…]`-Token ist NICHT nötig. Damit ist das
  frühere Haupt-Risiko (Threading-Bruch) vom Tisch; Rest = einmaliger Prod-Gegencheck mit
  echter Inbound-Mailbox als `Reply-To`.
- **Upstash** zuvor komplett entfernt (war nur Doku/.env, kein Code) → Caching nur via
  Next.js `unstable_cache`.

### [2026-06-05] Ticket-Zusammenführung — Reparent unmöglich → „Link & Close"
Schreib-Test an ZZZ-Tickets (TE 30548: 43180→43181, danach restauriert; alle companyID 0):
- **Kein natives Merge in der REST-API:** kein Merge-Feld auf Tickets; `TicketMerge` /
  `TicketMergeHistory` = 404. Das UI-Merge erzeugt nur noteType 93/94 (UI-only).
- **`TimeEntries.ticketID` NICHT umhängbar:** PATCH liefert **HTTP 200 `{itemId}`**, der
  `ticketID` bleibt aber **unverändert** (silently ignored — wie `noteExist`). Metadata
  `isReadOnly=false` ist hier irreführend; Zeiteinträge sind fest ans Ticket gebunden.
- **Anhänge** (`TicketAttachments.ticketID`/`parentID` = RO) und **Checklisten**
  (`TicketChecklistItems.ticketID` RO) ebenfalls nicht umhängbar.
- **Entscheidung (Pauls Fallback greift):** „+Zeiten" entfällt → **„Nur Link & Close"**.
  Merge = Quelltickets auf **Abgeschlossen (5)** + beidseitige **INTERNE** Verlinkungsnotizen
  (noteType 2 / publish 1, kundenunsichtbar): Quelle „Zusammengeführt in <Ziel-Nr>",
  Ziel „Zusammengeführt aus <Quell-Nr(n)>" angereichert mit **Titel + Beschreibung** der
  Quelltickets. Zeiten/Anhänge bleiben am (geschlossenen) Quellticket, in der Notiz erwähnt.
  Nutzt nur bestehende, verifizierte Schreibpfade (`ticketNotes.createInternal` +
  Status-PATCH) — kein neuer Schreibpfad, kein Reparenting.

### [2026-06-05] B26 Zusammenführen umgesetzt + Listen-Feinschliff (Paul-Feedback)
- **B26 „Link & Close" gebaut.** Bulk-Aktion „Zusammenführen" (`bulk-bar.tsx`), erscheint
  bei Auswahl, aktiv nur wenn alle Markierten dieselbe Firma haben. **Ziel aus einer
  suchbaren Liste der Firmen-Tickets** (neuer Endpoint `GET /api/tickets/by-company?
  companyId=&q=`), NICHT nur aus den Markierten (Paul-Korrektur). Markierte = Quellen.
  Server: `lib/autotask/entities/ticket-merge.ts` + `POST /api/tickets/merge` → interne
  Verlinkungsnotizen (noteType 2) beidseitig, Ziel-Notiz mit Titel + Beschreibung jeder
  Quelle, Quellen → Status 5. Firmen-Guard server- UND clientseitig. Verifiziert: Merge
  43183→43182 (Notizen + Status belegt via API); Dialog + Firmen-Trefferliste + Suche im
  Browser an Firma 0 geprüft (read-only, ohne echte Tickets zu schließen).
- **Zuweisen:** „Autotask Administrator" wird nicht mehr als zuweisbarer Mitarbeiter
  angeboten (`resources.listActive` filtert den Namen raus) — gilt für Bulk/Detail/Neues Ticket.
- **Filter-Dropdowns:** Status/Priorität/Queue/Zuweisung-Filter-`SelectContent` auf
  `w-auto min-w-*` gesetzt → lange Status-Labels werden nicht mehr abgeschnitten
  (`tickets-list.tsx`).

<!-- Neue Entscheidungen hier anhängen -->
