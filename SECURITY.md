# Security Policy

## Schwachstellen melden

Bitte **keine** Sicherheitslücken über öffentliche GitHub-Issues melden.

- Bevorzugt: über **GitHub → Security → Report a vulnerability** (Private Vulnerability
  Reporting) ein privates Advisory öffnen.
- Alternativ: den Maintainer direkt kontaktieren (Kontakt in der Repo-Beschreibung).

Wir bestätigen den Eingang zeitnah und halten dich über die Behebung auf dem Laufenden.

## Wie diese App mit Secrets umgeht

- **Keine Secrets im Repository.** `.env`/`.env.local` sind per `.gitignore` ausgeschlossen;
  versioniert ist nur `.env.example` mit Platzhaltern.
- **Backend-for-Frontend:** Autotask- und Entra-Zugangsdaten liegen ausschließlich
  server-seitig (`process.env`) und werden nie ins Client-Bundle, in Logs oder in
  API-Antworten an den Browser geschrieben. Der Browser spricht nur mit internen
  `/api`-Routen.
- **Schreibpfade** sind pro Route auf eine Feld-Whitelist begrenzt.
- **Auth fail-closed:** in Produktion muss `AUTH_MODE` explizit gesetzt sein – kein stiller
  Rückfall aufs passwortlose Mock-Login.
- **Kundenmail nur auf Bestätigung:** der Chat mailt nur bei aktivem Schalter (Default aus)
  und Bestätigungsdialog; Massen-Merge ist auf 10 Tickets gedeckelt.
- **Paging-Cursor** an den Browser sind opak (die Autotask-Basis-URL bleibt server-seitig).
- **Container:** Das Docker-Image enthält keine Secrets; Env wird erst zur Laufzeit injiziert
  (siehe `DEPLOY.md`). Der Server läuft als non-root.

## Empfehlungen für den Betrieb

- Secrets nur über die Laufzeit-Umgebung setzen (Vercel-Env, Docker `--env-file`,
  Secret-Manager) – niemals ins Image backen oder committen.
- `AUTOTASK_API_SECRET` rotieren, falls es jemals versehentlich in einer Datei/History
  gelandet ist.
- Im Entra-Modus minimale Scopes (`openid profile email`), keine Graph-App-Permissions.
