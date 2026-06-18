# Sicherheitsaudit & Härtung — pauls-autotask-ui

**Datum:** 2026-06-17 · **Umfang:** Statische Analyse (BFF vor Autotask-PROD-API),
adversariell verifiziert · **Methode:** 7 Angriffsdimensionen, jede Erkenntnis von
einem zweiten Prüfer gegen das App-Design gegengeprüft (False-Positives entfernt).

## Gesamteinschätzung

Architektur grundsätzlich sauber: Autotask-Zugangsdaten bleiben server-only, jede
datenliefernde Route erzwingt eine Session, Auth-Umschaltung ist fail-closed.
**Kein direkt ausnutzbarer Daten-Leak, keine Auth-Umgehung gefunden.** Alle realen
Befunde betrafen **fehlende Missbrauchs-Kontrollen** (Rate-Limiting, CSRF-Härtung,
eine ungeschützte Route) — Verfügbarkeit/Spam/Defense-in-Depth, nicht Vertraulichkeit.

Befunde nach Verifikation: **0 hoch · 3 mittel · 5 niedrig · 3 info.** Alle wurden
behoben (siehe unten).

## Neue Sicherheits-Bausteine

- `lib/security/origin.ts` — `csrfResponse(req)` / `isSameOriginRequest(req)`:
  Origin-/`Sec-Fetch-Site`-Prüfung als CSRF-Defense-in-Depth (zusätzlich zu SameSite=Lax).
- `lib/security/rate-limit.ts` — Sliding-Window-Rate-Limit pro Identität, verteilt über
  Upstash Redis (falls `UPSTASH_REDIS_REST_URL/_TOKEN` gesetzt), sonst In-Process-Fallback.
  Presets `RL`: `read` 120/min, `search` 30/min, `write` 40/min, `email` 12/min (pro Absender),
  `emailRecipient` 20/h (pro Empfänger), `merge` 8/min.
- `lib/security/api-guard.ts` — `guardApi(req, { rateLimit })`: bündelt CSRF (nur
  schreibende Methoden) + Session-Pflicht + Rate-Limit in einem Aufruf. Wird in **jeder**
  `app/api/**/route.ts` am Handler-Anfang aufgerufen.
- `middleware.ts` — **erzwingende**, nonce-basierte Content-Security-Policy
  (`strict-dynamic`, ohne `unsafe-inline`/`unsafe-eval` im `script-src`; `unsafe-eval`
  nur in DEV für HMR). Ersetzt die frühere Report-Only-CSP aus `next.config.ts`.

## Behobene Befunde

| Schwere | Befund | Datei(en) | Fix |
|---|---|---|---|
| Mittel | Unbegrenzte Zuweisungs-Mails an beliebige Resource | `app/api/tickets/notify-assignment/route.ts` | `guardApi` + `RL.email` (pro Absender) **plus** `RL.emailRecipient` (pro Empfänger) |
| Mittel | Unbegrenzte Kunden-Mails über Chat-„notify" | `app/api/tickets/[id]/chat/route.ts` | `guardApi`+`RL.write`; bei `notify=true` zusätzlich `RL.email` |
| Mittel | Kein Rate-Limit pro Nutzer/IP | alle `app/api/**/route.ts` | `guardApi` flächendeckend; Such-Routen mit engem `RL.search` |
| Niedrig | `GET /api/picklists` ohne Auth | `app/api/picklists/route.ts` | `guardApi`+`RL.read` |
| Niedrig | Popup-`generateMetadata` lädt vor dem Auth-Guard | `components/{tickets,companies}/*-detail-content.tsx` | `getSession()`-Gate vor Autotask-Read |
| Niedrig | Kein Origin/CSRF-Schutz auf Mutationen | alle mutierenden Routen | `guardApi` ruft `csrfResponse` für POST/PATCH/DELETE |
| Niedrig | Chat-Route `multipart/form-data` (preflight-freies CSRF-Ziel) | `app/api/tickets/[id]/chat/route.ts` | von `guardApi`-CSRF mit abgedeckt |
| Niedrig | CSP nur Report-Only | `next.config.ts` → `middleware.ts` | erzwingende Nonce-CSP |
| Info | `ENTRA_EMAIL_LOOSE_MATCH` weicht Mapping auf | `lib/autotask/entities/resources.ts` | in Prod ignoriert (+ Warnung); Kollision → kein Mapping |
| Info | Mock-Cookie ohne `secure` | `lib/auth/actions.ts` | `secure: NODE_ENV==='production'` |
| Info | `next-auth` Beta mit Caret | `package.json` | exakt gepinnt (`5.0.0-beta.31`) |

Zusätzlich gehärtet: Anhang-Download (`X-Content-Type-Options: nosniff` + `sandbox`-CSP
direkt auf der Antwort).

## Geprüft, aber KEIN Befund (bewusst akzeptiert)

- **Ticket-/Firmen-/Kontakt-„IDOR" = beabsichtigt.** Alle Mitarbeiter sehen dieselben
  Daten; keine Pro-Nutzer-Beschränkung. Einzige echte Autorisierungsgrenze ist der
  `/vertrieb`-Allowlist-Gate (`canAccessSales`, fail-closed) — geprüft, greift korrekt.
- **Mock-Auth in Prod = fail-closed.** `loginAs`/`switchMockUser` in Prod inert;
  `getAuthProvider` wirft bei unbekanntem `AUTH_MODE`.
- Login-CSRF (Mock, dev-only, framework-mitigiert), Subdomain-/SameSite-Restrisiko,
  Attachment-Content-Type — alle nur theoretisch/Defense-in-Depth.

## Verifikation

`npm run typecheck` ✓ · `npm run lint` ✓ · `npm run build` ✓ · Laufzeit-Smoke der
erzwingenden CSP (`next start`, `/login` im echten Browser): 0 CSP-Verstöße, alle
Skripte tragen den Request-Nonce. Authentifizierte Chart-/Editor-Ansichten wurden
nicht einzeln im Browser geprüft; sie nutzen dieselbe (verifizierte) Skript-Lade-
Mechanik und kein `eval`/Inline-Script (nur Inline-*Styles*, weiterhin erlaubt).

## Betrieb

- In Prod `UPSTASH_REDIS_REST_URL/_TOKEN` setzen, damit das Rate-Limit über mehrere
  Vercel-Instanzen hinweg greift (ohne Upstash: In-Process-Fenster pro Instanz).
- Schreibpfade weiterhin gegen die **Sandbox** verifizieren (Backend ist PROD).
