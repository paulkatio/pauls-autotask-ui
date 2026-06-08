# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

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
