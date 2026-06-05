# Contributing

Danke fürs Interesse. Diese App ist ein internes Werkzeug; Beiträge sind willkommen,
müssen aber zu den festgelegten Regeln passen.

## Verbindliche Regeln

Die **Verfassung** des Projekts ist [`CLAUDE.md`](CLAUDE.md) – bitte zuerst lesen. Kurz:

- **UI ausschließlich aus shadcn/ui + semantischen Tailwind-Tokens.** Keine weitere
  UI-Library, kein frei gemaltes Design, keine arbitrary Tailwind-Values (`[..]`) außer in
  `components/ui/`. Light + Dark über Tokens (keine manuellen `dark:`-Farb-Overrides).
- **Sprache:** UI Deutsch, echte Umlaute (ü/ö/ä/ß), keine Emojis (nur lucide-Icons).
- **Sicherheit:** Autotask-/Auth-Secrets bleiben server-seitig. Schreibpfade laufen über
  interne `/api`-Routen mit Feld-Whitelist.
- **Test-Disziplin:** Schreibende Tests **nur** gegen die Sandbox-Testfirma (siehe
  `CLAUDE.md` §5). Niemals „fertig" behaupten ohne echten Test.

## Setup

```bash
npm install
cp .env.example .env.local   # Werte eintragen (siehe README → Konfiguration)
npm run dev
```

## Vor jedem PR

- `npm run build` muss grün sein (typisiert + kompiliert).
- `npm run lint` ohne Fehler.
- `npm run test:e2e` grün (einmalig `npx playwright install chromium`).
- UI in **Light, Dark und Mobile** geprüft.
- Architektur-/Faktenrelevantes in `docs/DECISIONS.md` festhalten; Status in
  `docs/BACKLOG.md`.
- Kleine, nachvollziehbare Commits.

## Orientierung

- Stand & Architektur: [`docs/STATE.md`](docs/STATE.md).
- Repo-Karte: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
