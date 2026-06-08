# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

### Changed
- **Produktiv-Cutover:** Backend von der Sandbox auf den Autotask-**Produktiv-Mandanten**
  umgestellt (Zone DE1, eigener API-User → Thread-Budget von n8n entkoppelt).
- **Chat-Kundenmail ist jetzt opt-in:** Schalter „Per E-Mail an Kunden senden" (Default
  **aus**) mit Bestätigungsdialog; ohne Schalter wird nur die Notiz gespeichert. Server
  mailt nur bei explizitem `notify`.
- **Branding dynamisch:** Firmenname wird zur Laufzeit aus Autotask (`companyID 0`) gezogen
  (24 h gecacht); `NEXT_PUBLIC_ORG_NAME` bleibt optionaler Override.

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
