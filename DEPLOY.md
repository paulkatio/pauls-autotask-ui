# Deployment

Deployment-agnostisch: dasselbe Repo läuft als **Docker-Container** (z. B. hinter Caddy)
**oder** auf **Vercel**. JWT-Session (keine DB), Route-Schutz serverseitig (kein
`middleware.ts`), `output: "standalone"`.

> ⚠️ **Backend ist PRODUKTION** (Zone DE1, `webservices18`, eigener API-User). Schreibpfade
> wirken sofort + unumkehrbar gegen echte Kunden — kein Sandbox-Schutz, kein READ_ONLY-Riegel.
> Einziger Mail-Auslöser an Kunden: die Chat-Sidebar mit aktivem „Per E-Mail senden"-Schalter.

## Env-Variablen (zur Laufzeit injizieren, nie ins Image backen, nie committen)

```
# Autotask-Backend (immer)
AUTOTASK_BASE_URL=https://webservices18.autotask.net/ATServicesRest/V1.0   # MUSS auf /V1.0 enden
AUTOTASK_API_USERNAME=...
AUTOTASK_API_SECRET=...            # Quoting-Falle, siehe unten
AUTOTASK_INTEGRATION_CODE=...

# Auth-Weiche (in Prod zwingend explizit, sonst Abbruch = fail-closed)
AUTH_MODE=entra                    # oder: mock

# Nur bei AUTH_MODE=entra (Provider EXPLIZIT aus diesen Namen, nicht Auth.js-Defaults)
AUTH_SECRET=...                    # openssl rand -base64 32
ENTRA_CLIENT_ID=... ENTRA_CLIENT_SECRET=... ENTRA_TENANT_ID=...
AUTH_URL=https://<DOMAIN>          # öffentliche https-Domain
AUTH_TRUST_HOST=true               # nötig hinter Caddy/Non-Vercel
# ENTRA_EMAIL_LOOSE_MATCH=1        # NUR Sandbox (+psasandbox-Tag); in Prod weglassen

# Kundenmail (Resend)
RESEND_API_KEY=... RESEND_FROM=...           # RESEND_FROM = verifizierte Domain
AUTOTASK_INBOUND_MAILBOX=...                 # Reply-To = Autotask-Eingangspostfach

# Optional: globaler Thread-Limiter (Upstash Redis)
UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=...
```

**Secret-Quoting (häufigste 401-Ursache):** Enthält das Secret `$`/`#` —
- **`.env.local` (dotenv):** in **einfache** Quotes (`'...'`), sonst `#`=Kommentar / `$`=Expansion.
- **`docker --env-file` / Vercel-UI:** **KEINE** Quotes (Wert wird wörtlich genommen).
- Am einfachsten: Secret **ohne `$`** generieren.

**Upstash-Limiter:** gesetzt → instanzenübergreifender Semaphore
(`lib/autotask/global-limiter.ts`) hält das Autotask-3-Threads-Limit pro Objekt-Endpoint
**global** ein (wichtig bei mehreren Vercel-Instanzen); leer → In-Process-Limiter. Produkt =
Upstash **Redis** (Vercel → Storage/Marketplace → Upstash → Redis setzt die zwei Vars).

**Entra-Redirect-URI** in der App-Registrierung ergänzen (je Domain):
`https://<DOMAIN>/api/auth/callback/microsoft-entra-id` · Scope `openid profile email User.Read`.

## Vercel

1. Repo importieren (Preset **Next.js**). 2. Env-Vars (oben) setzen — **ohne** Anführungszeichen.
3. Entra-Redirect-URI für die Vercel-Domain ergänzen. `AUTH_URL` auf die Domain setzen.

## Docker (hinter Reverse-Proxy)

```bash
docker build -t autotask-ui .
# Marke wird zur Laufzeit aus Autotask gezogen (companyID 0); fester Name nur per
# --build-arg NEXT_PUBLIC_ORG_NAME="..." (Build-Zeit, auch fürs PWA-Manifest).
docker run -d --name autotask-ui --env-file ./prod.env \
  -p 127.0.0.1:3000:3000 --restart unless-stopped autotask-ui
curl -I http://127.0.0.1:3000/login    # erwartet HTTP 200
```

- Image enthält **keine** Secrets; `prod.env` bleibt auf dem Server. Container nur an
  `127.0.0.1` binden, TLS macht ein Proxy (z. B. Caddy, siehe `Caddyfile.example`).
- Multi-Arch (amd64+arm64): `docker buildx build --platform linux/amd64,linux/arm64 ... --push`.

**Häufige Stolpersteine:** „UntrustedHost" → `AUTH_TRUST_HOST=true` fehlt · 401 → Quotes in
`prod.env` (entfernen) · Marke „Acme GmbH" → Autotask-Creds/`companyID 0` zur Laufzeit fehlen ·
Login bricht ab → Redirect-URI ≠ `<AUTH_URL>/api/auth/callback/microsoft-entra-id`.
