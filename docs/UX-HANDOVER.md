# UX-Audit Remediation — Übergabe (für frisches Chatfenster ohne Kontext)

Du übernimmst die **Mikro-Politur** des UX/UI-X-Audits. Lies zuerst diese Datei,
dann `docs/UX-AUDIT.md` (die vollständige, abhakbare Befundliste) und
`CLAUDE.md` (Projektverfassung). Backend ist **Produktion** — Vorsicht bei Schreibpfaden.

---

## Was schon erledigt ist (committet + gepusht auf `master`)

High- + Medium-Tier des Audits + ein paar Live-Funde:
- **Fundament:** SelectTrigger-Höhe `sm:h-9` (default **und** `size=sm`); TableSkeleton-Default-Breakpoint `xl`; StatusDot über semantische Tokens (dunkelmodus-fest) statt Inline-Hex.
- **Breakpoint vereinheitlicht:** alle Listen schalten Karten→Tabelle bei **xl** (`grid-cols-1 [md:grid-cols-2] xl:hidden` + `hidden xl:block`). Alle 11 `sm:h-9!`-`!important`-Hacks entfernt.
- **Bedienhöhen:** alle `sm:h-7`/`sm:h-8` → `sm:h-9` (Tabs/Buttons/Inline-Edit/Zeitanzeige). Touch-Targets <44px gefixt (Login, no-access, header-autotask-link, „Alle anzeigen", bulk-bar X-Button `size-11`).
- **Single-Source:** Vertrags-Badge via `mappers.ts`; Kontakt-`tel`/`mailto` + „Mehr laden" als shadcn `Button`.
- **Abstände:** Vertrieb-Detailseiten `gap-6`.
- **Politur:** Projekt-Filter mobil `grid-cols-1`; Zeiten-Lade-Skeleton spiegelt die echte Stat-Zeile.
- **Live-Funde (nicht Audit):** Zeit-erfassen-Dialog ohne Dauer-Scrollbalken/Layout-Sprung; „Nachricht an den Kunden" als Slim-Rich-Text; Autotask-Notiz als Klartext + Kundenmail mit Ticket-Bezug/Titel/Antwort-Hinweis.

---

## Was noch offen ist

1. **Low + Nit (83 + 17 Befunde)** — die Arbeitsliste: **`docs/UX-AUDIT.md`** (nach Bereich → Severity sortiert, mit `[ ]`-Checkboxen). Das ist dein Backlog. Klein committen, pro Bereich/Thema.
2. **`docs/DECISIONS.md` ergänzen** (TODO, noch nicht erledigt): Autotask zeigt `TicketNotes.description` als **Rohtext** (HTML erscheint als sichtbare `<strong>`-Tags — per Screenshot an Ticket 56313 belegt). Konsequenz im Code: Notiz bekommt `plainTextFromRich` (Klartext, Listen → `• `), HTML lebt **nur** in der Kundenmail. Diesen API-Fakt dort festhalten.

---

## Verbindliche Standards (beim Weitermachen EINHALTEN)

- **Bedienhöhe:** `h-11` (mobil <640) → `sm:h-9` (≥640) für jedes Standalone-Control (Button/Select/Tab/Suche). **Kein** `sm:h-7`/`sm:h-8`. Icon-only-Buttons mobil ≥44px (`size-11`, ggf. `sm:size-9`). Die 44px gelten **nur** unter `sm`.
- **Listen-Breakpoint:** Karten→Tabelle immer bei **xl**. Ticket-Karten bleiben bewusst **einspaltig** (dichte Karte) — kein `md:grid-cols-2` dort.
- **Abstände:** Sektionen `gap-6`, Toolbars `gap-2`/`gap-3`, **`gap-*` statt `space-y-*`**. Seiten-Padding kommt aus `app/(app)/layout.tsx` (`p-4 md:p-6`).
- **Farben:** nur semantische Tokens (`bg-background`, `text-muted-foreground`, `bg-primary`, `text-destructive`, `bg-chart-2` …). **Nie** `bg-blue-500`/Hex/Inline-Style-Farbe. Badges/StatusDot über `lib/autotask/mappers.ts`. Zähler-Badge = `bg-chart-2/15 text-chart-2`.
- **Komponenten:** shadcn-only. Keine rohen `<a>/<button>/<input>` — Links als `<Button variant="…" render={<a … aria-label="…" />}>`.
- **Skeletons** müssen das echte Layout spiegeln (`components/skeletons.tsx`).
- **Dark Mode** automatisch über Tokens — keine manuellen `dark:`-Farb-Overrides.

## Bewusst SO gelassen (nicht „korrigieren", kein Bug)

- **Spotlight-Suche** (`command-palette` h-14, `search-box` h-12) ist absichtlich groß — nicht auf h-9 verkleinern.
- **Dashboard-KPI-Raster** `grid-cols-2 lg:grid-cols-4` — bei 4 Kacheln sauber; `md:grid-cols-3` würde eine Waise erzeugen.
- **Toolbar-Zähler** („X von Y") sind gedämpfter Text (kein Badge); Eltern-Toolbar ist `items-center` → bereits zentriert.
- **Detail-Header** (Firma/Projekt/Ticket) haben absichtlich eigenes Layout — nicht auf `PageHeader` zwingen.
- **ResponsiveDialog** (`components/ui/responsive-dialog.tsx`): Footer-Leck (negatives `-mb-4` im `<form>`) ist via `pb-0` am Popup + `mb-0` am Footer gelöst; Desktop ist inhaltsgroß (kein fixer Body-Cap). Muster bei neuen Dialogen beibehalten.

---

## Verifikation (PFLICHT vor jedem Commit)

1. **Gates:** `npm run typecheck` && `npm run lint` && `npm run build` — alle grün.
2. **Browser nur über MOCK-Dev** (der normale Dev läuft mit `AUTH_MODE=entra` = Microsoft-Login, nicht skriptbar):
   - Es geht nur **1 Next-Dev pro Verzeichnis** (Lock). Laufenden Dev auf :3000 stoppen.
   - `AUTH_MODE=mock npm run dev -- -p 3050` starten.
   - Im Browser: `/login` → Button **„Demo Teamlead"** klicken.
   - **Backend = PRODUKTION** (`.env.local`): KEINE Schreibvorgänge außer ans Testticket **56313 „ZZZ TESTTICKET"**.
   - Danach Mock-Dev stoppen, `npm run dev` (:3000, entra) wieder starten — Paul nutzt das Fenster.
3. **Responsive:** 320/375/414/768/1024/1280/1440/1920. `documentElement.scrollWidth <= clientWidth` (kein Querscroll). Listen: Karten @1024, Tabelle @1280.
4. Harness `.playwright-mcp/audit/audit.mjs` existiert, ist aber stumpf: zählt base-ui 1×1-Inputs als „smallTargets" (Rauschen) und prüft den Route-Load nicht (`response.status() < 400` + Landmark ergänzen), bevor du dich drauf verlässt.

## Konventionen

- Commits als **Paul Katio <paulkatio@gmail.com>**, **kein** `Co-Authored-By`. Klein committen. Push auf `master`.
- UI deutsch, echte Umlaute (ü ö ä ß). Keine Emojis.
