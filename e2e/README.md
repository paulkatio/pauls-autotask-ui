# E2E-Smoke-Tests (Playwright)

Wiederholbare Tests der Kernpfade gegen die laufende App (Mock-Auth, Autotask-
Sandbox). Bewusst schlank gehalten – sie prüfen, dass die wichtigsten Seiten und
Dialoge laden und der Inline-Schreibpfad funktioniert, nicht jede Detailregel.

## Ausführen

```bash
npm run test:e2e          # alle Smoke-Tests (startet bei Bedarf den Dev-Server)
npm run test:e2e:ui       # interaktiver Playwright-UI-Modus
```

Voraussetzungen: einmalig `npx playwright install chromium`. `.env.local` muss
gesetzt sein (`AUTH_MODE=mock`, Autotask-Sandbox-Creds) – die Tests lesen echte
Sandbox-Daten.

## Was getestet wird

- **Mock-Login** (`auth.setup.ts`): meldet sich als „Demo Teamlead" an und teilt
  den Cookie als `storageState` mit allen Tests (kein Login pro Test).
- **Listen/Seiten laden**: Dashboard (KPIs), Meine Tickets (Tabelle), Teamtickets,
  Meine Zeiten (Summen).
- **Ticketdetail** rendert (Testticket 43180).
- **Command-Palette** (Cmd/Ctrl+K) findet das Testticket und navigiert hinein.
- **Dialoge öffnen**: Zeit erfassen, Neues Ticket.
- **Inline-Schreibpfad** (einziger Schreibtest): Status am **Testticket 43180**
  ändern und wieder auf den Ausgangswert zurücksetzen.

## Schreibdisziplin

Schreibende Tests laufen **ausschließlich** am Testticket 43180 (Firma SSIG-IT
Sandbox, Kontakt Paul-Harald Katio). Es werden keine Datensätze gelöscht. Hinweis:
Autotask-Workflow-Regeln verändern den Status von 43180 gelegentlich selbst – der
Status-Test liest daher den Ausgangswert dynamisch und setzt ihn zurück.

### Schreibtests abschalten (`E2E_SKIP_WRITE_TESTS`)

Der einzige Schreibtest (Status-Inline-Edit an 43180) ist **lokal standardmäßig
aktiv**. Wer das Testticket bei einem Lauf nicht mutieren möchte (z. B. in CI oder
einem rein lesenden Durchlauf), setzt das Flag – der Test wird dann als *skipped*
markiert, alle Lesetests laufen normal:

```bash
# PowerShell
$env:E2E_SKIP_WRITE_TESTS = "1"; npm run test:e2e

# bash
E2E_SKIP_WRITE_TESTS=1 npm run test:e2e
```

Akzeptierte „an"-Werte: `1`, `true`, `yes` (case-insensitive). Ohne das Flag (oder
mit jedem anderen Wert) bleibt der Schreibtest aktiv.

## Artefakte

`playwright-report/`, `test-results/` und `e2e/.auth/` sind nicht versioniert
(siehe `.gitignore`).
