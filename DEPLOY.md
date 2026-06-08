# Deployment

Die App ist **deployment-agnostisch**: dasselbe Repo läuft als Docker-Container
(z. B. Hetzner hinter Caddy) **oder** auf Vercel. Keine Vercel-only-Abhängigkeit;
JWT-Session (keine DB); Route-Schutz server-seitig (kein `middleware.ts`);
Auth-Route auf Node-Runtime.

> **Backend bleibt vorerst Sandbox.** Der Wechsel der `AUTOTASK_*`-Creds auf den
> Produktiv-Mandanten ist ein **späterer, separater Schritt** (siehe unten) – jetzt
> nicht ändern.

---

## Env-Variablen (zur Laufzeit injizieren, NICHT ins Image backen)

**Immer nötig (Autotask-Backend, vorerst Sandbox):**
```
AUTOTASK_BASE_URL=https://webservices18.autotask.net/ATServicesRest/V1.0
AUTOTASK_API_USERNAME=...
AUTOTASK_API_SECRET=...        # Sonderzeichen -> in der Shell/Compose sauber quoten
AUTOTASK_INTEGRATION_CODE=...
```

**Auth-Modus:**
```
AUTH_MODE=mock     # oder: entra
```

**Kundenmail-Versand (B17, app-eigene Resend-Mail — einziger Weg):**
```
RESEND_API_KEY=...             # https://resend.com -> API Keys
RESEND_FROM=...                # verifizierte Resend-Domain, z. B. Acme Service Desk <service@example.com>
AUTOTASK_INBOUND_MAILBOX=...   # Reply-To = Autotask-Eingangspostfach (Antwort-Threading)
```

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
# Image bauen (eigene Marke optional als BUILD-ARG einbacken; NEXT_PUBLIC_* wird
# zur Build-Zeit eingebettet – ohne ARG bleibt der Default "Acme GmbH"):
docker build -t autotask-ui --build-arg NEXT_PUBLIC_ORG_NAME=SSIG-IT .

# Container starten – Env aus einer Datei (NICHT committen) injizieren
docker run -d --name autotask-ui \
  --env-file ./prod.env \
  -p 127.0.0.1:3000:3000 \
  --restart unless-stopped \
  autotask-ui
```

> **Lokal getestet (2026-06-08):** `docker build` + `docker run` laufen sauber;
> `GET /login` → `HTTP 200`, `GET /` → `307` (Redirect zum Login). Branding über
> `--build-arg` greift; ohne Arg erscheint „Acme GmbH".

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

## Später (separater Schritt): Prod-Autotask-Creds

Aktuell zeigt `AUTOTASK_*` auf die **Sandbox**. Für den echten Kundeneinsatz erst
nach Freigabe auf den Produktiv-Mandanten umstellen (eigener Schritt, eigene
Verifikation). ⚠️ Vorher gilt weiter die Sandbox-Test-Regel (Schreibtests nur an
Acme Sandbox / Paul-Harald Katio). Außerdem offen vor Kundeneinsatz: **B17**
(Kundenmail app-eigen via Resend) und **B17a** (Inbound-noteType in Prod bestätigen).
