# Deployment

Die App ist **deployment-agnostisch**: dasselbe Repo läuft als Docker-Container
(z. B. Hetzner hinter Caddy) **oder** auf Vercel. Keine Vercel-only-Abhängigkeit;
JWT-Session (keine DB); Route-Schutz server-seitig (kein `middleware.ts`);
Auth-Route auf Node-Runtime.

> **Backend ist auf PRODUKTION (seit 2026-06-08).** `AUTOTASK_*` zeigt auf den
> Produktiv-Mandanten (Zone DE1, `webservices18`, eigener API-User). Die Sandbox-Test-Regel
> (Schreibtests nur an Acme/Sandbox) greift in Prod **nicht** mehr – Schreibpfade sind scharf
> und unumkehrbar. Siehe „Prod-Cutover" unten.

---

## Env-Variablen (zur Laufzeit injizieren, NICHT ins Image backen)

**Immer nötig (Autotask-Backend, Produktion):**
```
AUTOTASK_BASE_URL=https://webservices18.autotask.net/ATServicesRest/V1.0   # MUSS auf /V1.0 enden, sonst 404
AUTOTASK_API_USERNAME=...
AUTOTASK_API_SECRET=...        # siehe Quoting-Hinweis unten
AUTOTASK_INTEGRATION_CODE=...  # = „Tracking-Identifikator" des API-Users
```

> **Secret-Quoting (häufigste 401-Ursache):** Enthält das Secret `$` oder `#`, ist das
> Verhalten je nach Loader unterschiedlich:
> - **`.env.local` (Next.js/dotenv):** in **einfache** Quotes setzen — `#` wäre sonst
>   Kommentar, `$` würde als Variable expandiert (Secret verstümmelt → 401).
> - **`docker --env-file` / Compose `environment:`:** **KEINE** Quotes — der Wert wird
>   wörtlich genommen, Quotes landen sonst im Secret (→ 401).
> Am einfachsten: in Autotask ein Secret **ohne `$`** generieren.

**Auth-Modus:**
```
AUTH_MODE=mock     # oder: entra
```
> **Fail-closed:** In Produktion (`NODE_ENV=production`, u. a. im Docker-Image) MUSS
> `AUTH_MODE` **explizit** `entra` oder `mock` sein. Ein fehlender/vertippter Wert lässt
> die App bewusst abbrechen, statt still aufs passwortlose Mock-Login zurückzufallen.
> Für echten Kundeneinsatz: `entra`.

**Kundenmail-Versand (B17, app-eigene Resend-Mail — einziger Weg):**
```
RESEND_API_KEY=...             # https://resend.com -> API Keys
RESEND_FROM=...                # verifizierte Resend-Domain, z. B. Acme Service Desk <service@example.com>
AUTOTASK_INBOUND_MAILBOX=...   # Reply-To = Autotask-Eingangspostfach (Antwort-Threading)
```

**Optional — globaler Thread-Limiter (Upstash Redis):**
```
UPSTASH_REDIS_REST_URL=https://<db>.upstash.io   # Vercel-UI: OHNE Anführungszeichen
UPSTASH_REDIS_REST_TOKEN=...                      # OHNE Anführungszeichen
```
> Gesetzt → ein instanzenübergreifender Semaphore (`lib/autotask/global-limiter.ts`) hält das
> Autotask-3-Threads-Limit pro Objekt-Endpoint **global** ein (wichtig bei mehreren Vercel-
> Instanzen). Leer → In-Process-Limiter (Fallback). Upstash-Produkt: **Redis** (Vercel →
> Storage/Marketplace → Upstash → Redis-DB setzt die zwei Vars automatisch).

**Nur bei `AUTH_MODE=entra` zusätzlich** (der Provider wird in `lib/auth/authjs.ts`
explizit aus den `ENTRA_*`-Namen konfiguriert, **nicht** aus den Auth.js-Defaults):
```
AUTH_SECRET=...                          # openssl rand -base64 32
ENTRA_CLIENT_ID=<client id>
ENTRA_CLIENT_SECRET=<client secret>
ENTRA_TENANT_ID=<tenant id>              # tenant-spezifischer Issuer (.../<tenant>/v2.0)
AUTH_URL=https://<DOMAIN>                # öffentliche https-Domain
AUTH_TRUST_HOST=true                     # nötig hinter Caddy/Non-Vercel
# ENTRA_EMAIL_LOOSE_MATCH=1             # NUR Sandbox (+psasandbox-Tag); in Prod weglassen
```

**Entra-App-Registrierung:** die Prod-Redirect-URI ergänzen:
`https://<DOMAIN>/api/auth/callback/microsoft-entra-id` · Scope
`openid profile email User.Read` (User.Read = Profilfoto via Graph).

---

## (a) Docker + Hetzner hinter Caddy

```bash
# Image bauen. Der Markenname wird zur Laufzeit automatisch aus Autotask gezogen
# (eigene Firma = companyID 0). Ein BUILD-ARG ist nur nötig, wenn du einen abweichenden
# Namen ODER den korrekten PWA-Manifest-Namen einbacken willst (NEXT_PUBLIC_* = Build-Zeit):
docker build -t autotask-ui .
# docker build -t autotask-ui --build-arg NEXT_PUBLIC_ORG_NAME="SSIG-IT GmbH" .

# Container starten – Env aus einer Datei (NICHT committen) injizieren
docker run -d --name autotask-ui \
  --env-file ./prod.env \
  -p 127.0.0.1:3000:3000 \
  --restart unless-stopped \
  autotask-ui
```

> **Mehr-Plattform (amd64 + arm64):** `docker build` baut nur für die Arch des Hosts. Ein
> Image für Intel/AMD **und** ARM (Apple Silicon, ARM-Server) braucht buildx:
> ```bash
> docker buildx build --platform linux/amd64,linux/arm64 -t <registry>/autotask-ui:tag --push .
> ```

> **Verifiziert (2026-06-08):** `docker build` (Multi-Stage, node:22-alpine, standalone,
> non-root) + `docker run` laufen sauber; `GET /login` → `HTTP 200`. Branding über
> `--build-arg` greift; ohne Arg/ohne Autotask-Creds erscheint der Fallback „Acme GmbH".

- Das Image enthält **keine** Secrets; `prod.env` (mit obigen Variablen) bleibt auf
  dem Server und wird zur Laufzeit gelesen. `NEXT_PUBLIC_ORG_NAME` wirkt nur zur
  **Build-Zeit** (Branding) — zur Laufzeit nicht mehr änderbar.
- Container nur an `127.0.0.1:3000` binden – öffentlich erreichbar macht ihn erst
  Caddy.
- **Caddy** (TLS + Reverse-Proxy): siehe `Caddyfile.example`. Im Entra-Modus
  `AUTH_URL=https://<DOMAIN>` und `AUTH_TRUST_HOST=true` setzen.

Health-Check (lokal):
```bash
curl -I http://127.0.0.1:3000/login    # erwartet HTTP 200
```

---

## (b) Vercel

- Repo importieren; Framework-Preset **Next.js** (Build/Output automatisch).
  `output:'standalone'` stört Vercel nicht.
- Env-Variablen (siehe oben) im Vercel-Projekt setzen (Production/Preview).
  `AUTH_URL`/`AUTH_TRUST_HOST` sind auf Vercel nicht zwingend (Host wird erkannt),
  schaden aber nicht – `AUTH_URL` auf die Vercel-Domain setzen.
- Entra-Redirect-URI für die Vercel-Domain ergänzen:
  `https://<PROJEKT>.vercel.app/api/auth/callback/microsoft-entra-id`.

---

## Prod-Cutover (erfolgt 2026-06-08)

`AUTOTASK_*` zeigt auf den **Produktiv-Mandanten** (Zone DE1, `webservices18`, eigener
API-User „AutoTask UI" — entkoppelt das Thread-Budget von n8n). Verifiziert read-only via
`node --env-file=.env.local scripts/verify-api.mjs ping`.

Beim Umstellen aufgetretene Stolperfallen (siehe Secret-Quoting + Base-URL oben):
- `AUTOTASK_BASE_URL` **muss** auf `/V1.0` enden (sonst 404).
- Zone des API-Users notfalls per `zoneInformation` ermitteln:
  `https://webservices.autotask.net/atservicesrest/v1.0/zoneInformation?user=<API-User>`.

**Sicherheits-Härtung beim Cutover (Code):** Auth fail-closed (`AUTH_MODE` muss in Prod
explizit gesetzt sein), Kundenmail im Chat opt-in + Bestätigung statt Default-an,
Merge-Cap (max 10 Quelltickets), `ENTRA_EMAIL_LOOSE_MATCH` in Prod entfernt. Details:
[`docs/DECISIONS.md`](docs/DECISIONS.md) → „Produktiv-Cutover + Sicherheits-Härtung".

> ⚠️ **Kein globaler READ_ONLY-Schalter** im Code. Jeder Schreibpfad wirkt sofort gegen
> Produktion. Einziger Mail-Auslöser an echte Kunden: die Chat-Sidebar mit aktivem
> „Per E-Mail senden"-Schalter.
