# CLAUDE.md

Diese Datei ist die **verbindliche Verfassung** dieses Projekts. Du (Claude Code)
liest sie bei jeder Session zuerst. Alle Regeln hier haben Vorrang vor allem,
was du sonst für sinnvoll halten würdest.

Der Auftraggeber (Paul) ist **kein Programmierer**. Er kann den Code nicht selbst
prüfen oder reparieren. Das hat eine direkte Konsequenz für dein Verhalten:
**Du behauptest niemals, etwas funktioniere, wenn du es nicht tatsächlich
getestet hast.** Lieber "noch offen, weil X nicht verifiziert" als ein falsches
"fertig".

---

## 1. Was dieses Projekt ist

Eine interne Web-App als fokussierte, modernere Alternative zur klassischen
Autotask-Oberfläche. Kein Ersatz für ganz Autotask – nur das, was Techniker und
Service-Desk täglich brauchen:

- Dashboard "Meine Tickets" mit KPI-Kacheln und Arbeitsliste
- Ticketlisten (meine / Team) mit guten Filtern
- Aufgeräumte Ticketdetailseite
- Chatartige Sidebar im Ticket (basiert technisch auf TicketNotes)

Die App ist ein **Backend-for-Frontend (BFF)** vor der Autotask REST API: Der
Browser spricht ausschließlich mit internen API-Routen dieser App. Autotask-
Zugangsdaten bleiben **immer** serverseitig.

Den vollständigen fachlichen Bauplan findest du in `docs/BLUEPRINT.md`.

---

## 2. Tech-Stack (verbindlich, nicht verhandelbar)

- **Framework:** Next.js (App Router) + TypeScript
- **Styling:** Tailwind CSS v4
- **UI-Komponenten:** **shadcn/ui** – und sonst nichts
- **Charts:** die in shadcn/ui eingebaute `Chart`-Komponente (kapselt Recharts).
  Es wird **kein `@tremor/react` installiert.** Der ältere Tremor-Ansatz mit
  npm-Paket und zentraler Theme-Config ist eingestellt; seine Funktionalität
  steckt heute in shadcn/ui-Chart.
- **Icons:** die im Projekt konfigurierte Icon-Library (per
  `npx shadcn@latest info` prüfen, i.d.R. `lucide-react`). Keine Emojis als
  Icons.
- **Auth:** eigene Abstraktionsschicht (siehe Abschnitt 4). Phase 1 = Mock,
  später Microsoft Entra ID via Auth.js.
- **Hosting-Ziel:** Vercel (aber lokale Entwicklung steht an erster Stelle).
- **Caching (optional, später):** Upstash Redis / Vercel KV für Picklists.

**Verboten:**
- Keine weitere UI-Library (MUI, Chakra, Bootstrap, Mantine, Ant, DaisyUI …).
- Kein `@tremor/react`.
- Kein eigenes, frei gemaltes Design. Du **komponierst** aus shadcn-Bausteinen.
- Kein Custom-CSS außer Tailwind-Utility-Klassen.

---

## 3. shadcn/ui – wie du damit arbeitest

Es ist eine `shadcn`-Skill installiert. Nutze sie. Die wichtigsten Regeln:

1. **Bestehende Komponenten zuerst.** Vor eigenem Markup immer
   `npx shadcn@latest search` und `npx shadcn@latest docs <component>` prüfen.
2. **Komponieren statt neu erfinden.** Dashboard = Sidebar + Card + Chart +
   Table. Settings = Tabs + Card + Form-Controls.
3. **Eingebaute Varianten vor eigenem Styling.** `variant="outline"`,
   `size="sm"` usw.
4. **Semantische Farben.** `bg-background`, `text-muted-foreground`,
   `bg-primary` – **niemals** `bg-blue-500` o. Ä.
5. **`className` nur für Layout, nie für Farben/Typografie.**
6. **Abstände mit `gap-*`** (in `flex`/`grid`), nicht `space-y-*`.
7. **Formulare** mit `FieldGroup` + `Field`, nicht roh mit `div` + `Label`.
8. **Callouts** = `Alert`, **leere Zustände** = `Empty`, **Toasts** = `sonner`,
   **Lade-Platzhalter** = `Skeleton`. Kein eigenes Markup dafür.

### Komponenten-Beschaffung (verbindlich, bei JEDER UI-Aufgabe)
1. **Erst suchen, nicht bauen.** Vor jedem UI-Bau zuerst
   `npx shadcn@latest search` (plus `view`/`docs` zum Ansehen): Gibt es einen
   fertigen **BLOCK** (ganze Sektion – z. B. Dashboard-, Sidebar-, Login-,
   Data-Table-Block) oder eine fertige Komponente, die die Aufgabe ganz oder
   größtenteils abdeckt?
2. **Präferenz-Reihenfolge, strikt:**
   - (a) **Fertigen Block übernehmen.**
   - (b) Sonst aus **offiziellen shadcn-Primitiven komponieren** – nach dem Muster
     eines existierenden Blocks/Beispiels.
   - (c) **NIEMALS optisch frei erfinden:** kein hand-gerolltes CSS, keine
     selbstausgedachten Widgets, kein eigenes Styling. Aussehen kommt
     ausschließlich aus den Komponenten + semantischen Tokens.
3. **Jedes sichtbare UI-Element ist eine echte shadcn-Komponente mit nachweisbarer
   Quelle.** Layout/Anordnung ist erlaubt (das ist kein Erfinden); Aussehen nicht.
4. **Community-Registries nur nach Rückfrage.** Wenn keine offizielle
   shadcn-Komponente passt und eine Community-Registry nötig wäre (z. B. eine
   Chat-Komponente): **STOPP und Paul fragen, welche Registry** – nicht raten,
   nicht selbst wählen.
5. **Nachvollziehbarkeit.** In jedem Feature-Slice-README kurz notieren, aus
   welchem Block / welchen Komponenten die Sektion zusammengesetzt ist.

### Dark Mode
Bright und Dark Mode sind **Pflicht**. Sie entstehen **automatisch** über die
semantischen Tokens von shadcn/ui. Schreibe **keine** manuellen `dark:`-
Farbüberschreibungen. Ein Theme-Umschalter (Light / Dark / System) gehört in den
Header; nutze dafür `next-themes` zusammen mit shadcn.

---

## 4. Auth-Architektur (Mock jetzt, Entra ID später)

Der Login ist der fehleranfälligste Teil. Deshalb wird er **von Anfang an sauber
gekapselt**, damit der spätere Umstieg auf Entra ID nur eine Datei + eine
Umgebungsvariable kostet.

Lege an:

```
lib/auth/
  session.ts        // Typ SessionUser – die EINZIGE Repräsentation des Users
  provider.ts       // Interface AuthProvider { getSession(): Promise<SessionUser|null> }
  mock-provider.ts  // liest Dev-Auswahl (Cookie), mappt auf echte Sandbox-Resource
  entra-provider.ts // SPÄTER: Auth.js Entra ID, füllt dieselbe SessionUser-Form
  index.ts          // wählt Provider anhand von process.env.AUTH_MODE (mock|entra)
```

`SessionUser` muss exakt die Felder enthalten, die Entra ID später liefern wird:

```ts
type Role = "agent" | "teamleiter" | "admin";

interface SessionUser {
  id: string;                 // stabile User-ID (Mock: frei; Entra: oid)
  email: string;              // UPN / Mail
  displayName: string;
  roles: Role[];              // Mock: frei wählbar; Entra: aus groups/roles-Claims
  autotaskResourceId: number; // Mapping auf Autotask-Resource, nötig für "Meine Tickets"
}
```

**Regel:** Server-Komponenten und Route-Handler lesen **ausschließlich**
`SessionUser`. Niemand greift direkt auf "den Login" zu. Der Mock-Provider bietet
einen einfachen User-Umschalter (z. B. Dropdown im Header, nur wenn
`AUTH_MODE=mock`), mit dem Paul zwischen echten Sandbox-Resources wechseln kann.

---

## 5. Autotask-Zugriff (BFF-Regeln)

- Ein zentraler Client in `lib/autotask/client.ts`, **server-only**. Liest
  Base-URL, Username, Secret und Integration-Code aus `process.env`. Diese Werte
  tauchen **niemals** im Client-Bundle, in Logs oder in API-Antworten an den
  Browser auf.
- **Thread-Limit beachten:** Autotask erlaubt nur **3 parallele Requests pro
  Tabelle**. Baue im Client einen Concurrency-Limiter (max. 3 gleichzeitig pro
  Entität, sicherheitshalber eher 2). Bei `429` exponentielles Backoff + saubere
  Fehlermeldung an die UI.
- **Rate-Limit:** ~10.000 Requests pro rollierender 60-Minuten je Tenant.
  Listen daher serverseitig pagen, Picklists cachen (30–60 s).
- **Schreiboperationen sind gesperrt**, bis Phase 0 sie für das jeweilige Feld
  verifiziert hat (siehe Abschnitt 6). Im MVP einzig erlaubter Schreibpfad nach
  Verifikation: TicketNotes anlegen (Chat) und ausgewählte Ticket-Felder.

### Test-Schreibvorgänge in der Sandbox – ZWINGEND
Die Sandbox enthält **echte Kontakte mit potenziell echten E-Mail-Adressen**.
Ein Test-Ticket / eine Test-Notiz an einem fremden Kontakt kann eine echte Mail
auslösen. Deshalb gilt ausnahmslos:

- **Test-Schreibvorgänge NUR an der Firma „SSIG-IT GmbH Sandbox“**
  (`companyID = 0`).
- **Als Kontakt IMMER „Paul-Harald Katio“** (`contactID = 30684646`,
  Mail `qalab@autotask.com` = Sandbox-Catch-all, keine echte Zustellung).
- **Niemals** ein fremdes Unternehmen oder einen fremden Kontakt für Tests
  verwenden – auch nicht „nur kurz“.
- Test-Datensätze klar als Test markieren (Titel-Präfix `ZZZ TEST`).

---

## 6. Arbeitsdisziplin (sehr wichtig)

1. **Erst `docs/DECISIONS.md` lesen.** Dort stehen alle bereits verifizierten
   API-Fakten. Verlasse dich nicht auf Annahmen aus dem Blueprint, wenn in
   DECISIONS.md ein verifizierter Wert steht.
2. **Backlog der Reihe nach.** Arbeite `docs/BACKLOG.md` von oben nach unten ab.
   Der allererste Block ist **B00 = Phase 0 (API-Verifikation)** gemäß
   `docs/PHASE-0-API-VERIFICATION.md`. **Schreibe keine Geschäftslogik und keine
   Schreibpfade, bevor B00 abgeschlossen und in DECISIONS.md dokumentiert ist.**
3. **Befunde sofort festhalten.** Jedes API-Ergebnis, jede getroffene
   Architekturentscheidung wanderst du in `docs/DECISIONS.md`. Das ist das
   Gedächtnis über Sessions hinweg.
4. **Keine "ungefähr fertig"-Behauptungen.** Eine Funktion gilt erst als erledigt,
   wenn ihre Akzeptanzkriterien im Backlog erfüllt und – wo möglich – durch einen
   echten Aufruf gegen die Sandbox belegt sind.
5. **Klein committen.** Lieber viele kleine, nachvollziehbare Schritte als ein
   großer Sprung.

---

## 7. Sprache & Formatierung

- **UI-Sprache: Deutsch.** Spätere Zweisprachigkeit ist möglich, aber kein MVP-Ziel.
- **Umlaute immer als echte Unicode-Zeichen:** ü ö ä Ü Ö Ä ß. Niemals ue/oe/ae/ss.
- **Keine Emojis** im Code. In der UI nur echte Icons aus der Icon-Library.
- Code-Kommentare dürfen Deutsch oder Englisch sein; bleibe innerhalb einer Datei
  konsistent.

---

## 8. Definition of Done (für das Gesamtprojekt)

- App startet lokal fehlerfrei (`dev`), buildet fehlerfrei (`build`).
- Login funktioniert im Mock-Modus; Entra-Umstieg ist über `AUTH_MODE` vorbereitet.
- Dashboard, Meine Tickets, Teamtickets, Ticketdetail, Chat-Sidebar laufen stabil
  gegen die Autotask-Sandbox.
- UI besteht ausschließlich aus shadcn/ui-Komponenten; Light + Dark Mode
  funktionieren.
- Alle in Phase 0 als "Blocker" markierten Punkte sind entweder gelöst oder in
  DECISIONS.md klar als "nicht möglich / Workaround X" dokumentiert.
