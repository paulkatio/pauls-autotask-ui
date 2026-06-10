# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

### Changed
- **Mobile/PWA als vollwertige App (statt „Desktop klein"):**
  - **In-App-Navigation:** Tippen auf Ticket/Firma öffnet mobil/PWA IN der App
    (`hooks/use-record-nav.ts` + `lib/standalone.ts`) statt per `window.open` einen
    neuen Browser-Tab; Desktop behält die Autotask-artigen Pop-out-Fenster.
  - **Bottom-Navigation** (`components/mobile-bottom-nav.tsx`, nur mobil):
    Übersicht · Meine · Team · Suche · Mehr. Mobiler Header umgebaut: Logo links
    (`header-logo.tsx`), Zurück-Button auf Detailseiten (`header-back.tsx`),
    Hamburger rechts; Sidebar fährt mobil von **rechts** ein.
  - **Safe-Areas / Tastatur:** `viewport-fit=cover`, `interactiveWidget=resizes-content`,
    `env(safe-area-inset-*)` an Header/Bottom-Nav/Sheets, `dvh` statt `vh`,
    Tap-Highlight aus, `overscroll` nur in der installierten PWA.
  - **Bottom-Sheets statt zentrierter Dialoge** auf Mobile
    (`components/ui/responsive-dialog.tsx`, base-ui `Sheet` – kein vaul): Neues Ticket,
    Zeit erfassen. Dialog/AlertDialog mit `max-h-[90dvh]`. Chat-Composer als echtes
    Flex-Layout (Eingabe tastatursicher unten).
  - **Mobile Filterleiste als Chips** (Ticketlisten): Pillen mit Umbruch, aktiver
    Filter hervorgehoben; Touch-Ziele ≥40 px. Desktop-Toolbar unverändert.
  - **Ticketdetail – mobiler Case-Header:** kompakter „Ticket Summary" (Eyebrow-Nummer,
    Titel, Status/Priorität als Chips, Firma/Kontakt/Verantwortlich/Erstellt als ruhige
    Kontextzeilen) vor den ausklappbaren Schienen; Desktop unverändert.
  - **Command-Palette** mobil zentriert + höhenbegrenzt.
- **Meine/Teamtickets ohne Paginierung:** zeigen jetzt **alle** offenen Tickets in einer
  langen Liste (`getTicketsAll`, Cap 500 mit Hinweis), kein Zurück/Weiter mehr.
- **„Dashboard" → „Übersicht"** (Bottom-Nav, Sidebar, Suche, Seitentitel) – deutsches Label.
- **Produktiv-Cutover:** Backend von der Sandbox auf den Autotask-**Produktiv-Mandanten**
  umgestellt (Zone DE1, eigener API-User → Thread-Budget von n8n entkoppelt).
- **Chat-Kundenmail ist jetzt opt-in:** Schalter „Per E-Mail an Kunden senden" (Default
  **aus**) mit Bestätigungsdialog; ohne Schalter wird nur die Notiz gespeichert. Server
  mailt nur bei explizitem `notify`.
- **Branding dynamisch:** Firmenname wird zur Laufzeit aus Autotask (`companyID 0`) gezogen
  (24 h gecacht); `NEXT_PUBLIC_ORG_NAME` bleibt optionaler Override.
- **Einheitliches mobiles Karten-System:** neue, gemeinsame `TicketCard`
  (`components/tickets/ticket-card.tsx`) für alle mobilen Ticketlisten – Aufbau immer
  Titel → „Firma · Nummer" → Status/Priorität/Queue/Bearbeiter → Kontextdatum. Varianten
  `worklist` (Meine/Team/secondary/ball/Kundenakte → „Fällig …") und `activity`
  (Dashboard → „Aktualisiert …", bei neuem Ticket „Erstellt …"). `TicketsList` und die
  Listen teilen dieselbe Karte; Firmen/Kontakte teilen die Karten-Sprache.
- **Dashboard-Sektion „Offene Tickets"** (ersetzt „Letzte Aktivität"): zeigt offene
  Tickets team-weit im selben Listen-Look wie „Teamtickets" (Karten mobil, Tabelle ab xl),
  mit Schnellfilter „Alle offenen / Nur nicht zugewiesene" (clientseitig, kein
  Seiten-Neuladen) und einem Button „Alle offenen Tickets anzeigen". Die alte
  `RecentlyEdited`-Komponente entfällt.

### Security
- **Auth fail-closed:** in Produktion muss `AUTH_MODE` explizit `entra`/`mock` sein – kein
  stiller Mock-Fallback mehr (Schutz vor versehentlich passwortlosem Login gegen Prod-Daten).
- **Merge gedeckelt:** max. 10 Quelltickets pro Zusammenführung (kein versehentlicher
  Massen-Abschluss).
- `ENTRA_EMAIL_LOOSE_MATCH` in Produktion entfernt (exakter E-Mail→Resource-Abgleich).

### Fixed
- **Dashboard „Tickets pro Mitarbeiter":** abgeschnittene schräge Achsen-Labels – die
  Achsenhöhe passt sich jetzt dynamisch an die Namenslänge an (Plot-Höhe konstant).
- **Docker-Build** lief nach der Auth-Härtung nicht mehr (Prerender ohne `AUTH_MODE`);
  fail-closed greift nun nur zur Laufzeit, nicht während `next build`.
- **Autotask-Thread-Keying:** Kind-Schreibpfade (`…/Notes`, `…/Attachments`) zählen jetzt
  aufs korrekte Objekt-Budget (`TicketNotes`/`TicketAttachments`) statt aufs Parent
  „Tickets" – behebt ein theoretisches 429-Szenario am `TicketNotes`-Endpoint.

### Added
- **10k/h-Frühwarn-Monitor** (`lib/autotask/rate-monitor.ts`): loggt bei 80 % des
  Autotask-Stundenlimits eine Warnung (Zähler pro Instanz, Betriebs-Hinweis, kein Riegel).

### Docs
- README/DEPLOY/STATE/DECISIONS auf Prod-Stand: Secret-Quoting (`.env.local` vs.
  `docker --env-file`), `/V1.0`-Pflicht, Docker Multi-Arch (buildx), Branding aus `companyID 0`.

## [0.1.0] – 2026-06-08

Erste zusammenhängende Vorab-Version (Pre-1.0): die App läuft stabil gegen die
Autotask-**Sandbox**. Der Produktiv-Cutover steht noch aus (siehe `docs/STATE.md`).

### Added
- **Dashboard** mit KPI-Kacheln (offene / Pool / Zusätzlicher Mitarbeiter / Ball
  liegt bei mir), Diagramm „Tickets pro Mitarbeiter" und Liste „heute bearbeitet"
  mit Zeitraum-Filter (Heute / 3 / 7 Tage).
- **Ticketlisten** (Meine / Team / Neben / Ball) mit serverseitigen Filtern,
  Volltextsuche, **Bulk-Aktionen mit Undo** und per Drag & Drop umsortierbaren Spalten.
- **Ticketdetail** mit Inline-Edit, **Chat-Sidebar inkl. Kundenmail via Resend**
  (Senden legt die TicketNote an und mailt; Antworten threaden über die Ticketnummer
  zurück), Zeiterfassung + Stoppuhr, interne Notizen, Anhänge.
- **Firmen/Kundenakte** und **Kontakte** mit Suche und Filter.
- **Globale Suche** als Spotlight-Palette (`Cmd/Ctrl+K`) und `/search`-Seite.
- **Auth** gekapselt: lokaler Mock-Login **oder** Microsoft Entra ID (`AUTH_MODE`),
  Profilbild aus Microsoft Graph.
- **Pop-out-Fenster** für Ticket-/Firmen-Detail, In-App-Kontakt-Modal.
- Durchgängig **mobile-first responsiv** (Listen als Karten, KPI 2×2), Light/Dark
  über semantische Tokens, layout-treue Lade-Skeletons.
- **BFF-Kern**: server-only Autotask-Client mit Concurrency-Limiter (2/Entität),
  429-Backoff und Auto-Paging; Schreibpfade pro Route auf eine Feld-Whitelist begrenzt.

### Verifiziert
- Chat→Kundenmail via Resend in der Sandbox **zugestellt**; Inbound-Antwort threadet
  über die Ticketnummer zurück ans Ticket (noteType 3 + `createdByContactID`).

[Unreleased]: https://github.com/paulkatio/pauls-autotask-ui/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/paulkatio/pauls-autotask-ui/releases/tag/v0.1.0
