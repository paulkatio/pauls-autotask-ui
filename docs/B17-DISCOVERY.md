# B17-DISCOVERY — Bestandsaufnahme „app-eigene Kundenmail (Resend)"

> Stand: 2026-06-05. **Reine Lese-Bestandsaufnahme** – nichts geändert, keine Mail
> gesendet, UDF/Workflow nicht angefasst. Quelle aller Live-Zahlen: **App-eigener
> Sandbox-Mandant** (`.env.local`-Creds, NICHT das Autotask-MCP – vgl. DECISIONS
> „MANDANTEN-WARNUNG"). Abgefragt read-only über `query` / `query/count` /
> `entityInformation` (Wegwerf-Probes, nach Lauf entfernt).

Diese Datei ist die Planungsgrundlage für **B17** (Kundenmail app-eigen via Resend
statt UDF/Workflow-Race) und **B17a** (Inbound-noteType in Prod bestätigen). Sie
gliedert sich in: **Fakten mit Beleg** → **offene Fragen an Paul** →
**Architektur-Empfehlung + Risiken**.

---

## 0. Kurzfazit (das Wichtigste zuerst)

1. **Outbound heute** = `POST /api/tickets/[id]/chat` → Notiz `noteType 18` +
   davor UDF „Kunde benachrichtigen" = Ja/Nein setzen (Option A, kein Reset). Eine
   **Autotask-Workflow-Regel** macht daraus die echte Kundenmail. **Keine
   Resend-/Mail-Integration im Repo vorhanden.** `AUTH_MODE` = **mock**.
2. **Die Chat-UI hat aktuell GAR KEINEN „Kunde benachrichtigen"-Schalter** – sie
   sendet hartkodiert `notify:true` ([ticket-chat.tsx:118](../components/tickets/ticket-chat.tsx#L118)).
   Heißt: **jede** gesendete Chat-Nachricht bewaffnet die Mail und lässt das UDF auf
   „Ja" stehen. Das „stuck Ja"-Leck aus DECISIONS B11 ist damit faktisch Dauerzustand.
3. **Inbound-Befund kippt eine Kernannahme:** In 209.639 historischen TicketNotes
   gibt es **0 Notizen vom `noteType 101` („Email Note")**. Eingehende
   Kundenmails/-antworten landen in diesem Mandanten als **`noteType 3`
   (Aufgabennotizen) mit gesetztem `createdByContactID`** (976 Stück tragen den
   Mail-Antwort-Präfix „AW:"). Der Chat filtert aber auf `noteType ∈ {18, 101}` →
   **echte Kundenantworten würden im Chat NICHT erscheinen.** Das ist der eigentliche
   Kern von B17a und größer als bisher gedacht.
4. **Threading-Token gefunden:** Autotask hängt an seine Benachrichtigungs-Mails
   einen Betreff-Token **`[Ticket#<16 Ziffern>]`** (z. B.
   `[Ticket#2022050303020793]`). Dieser Token ist **Autotask-generiert und ist NICHT
   die Ticketnummer** – wir können ihn von außen **nicht** erzeugen. Das ist das
   zentrale Risiko für „Reply-To-Threading" bei selbst versendeten Resend-Mails.
5. **Mailbox-Adresse und Workflow-Regel sind per REST-API NICHT auslesbar** (alle
   Kandidaten-Entitäten liefern 404). → harte Paul-Fragen.

---

## 1. IST-Zustand Outbound (Code)

### 1.1 Der Sende-Pfad (Datei für Datei)

| Schicht | Datei | Rolle |
|---|---|---|
| UI | [components/tickets/ticket-chat.tsx](../components/tickets/ticket-chat.tsx) | Chat-Bubbles + Eingabe. Sendet `POST .../chat` mit **`notify:true` hartkodiert** (Zeile 118). Zeigt fix den Alert „Nachrichten werden per E-Mail zugestellt." |
| Route (BFF) | [app/api/tickets/[id]/chat/route.ts](../app/api/tickets/[id]/chat/route.ts) | `POST` liest `{text, notify}`; `notify = body.notify !== false` (Default **an**). Ruft `sendTicketChatNote(id, text, notify)`. |
| Entity | [lib/autotask/entities/ticket-chat.ts](../lib/autotask/entities/ticket-chat.ts) | `sendTicketChatNote`: pro Ticket serialisiert (`withTicketLock`). **Erst** `tickets.setNotify(id, notify)`, **dann** `ticketNotes.create(...)` mit `noteType 18, publish 1`. Kein Reset (Option A). |
| Entity | [lib/autotask/entities/tickets.ts:104](../lib/autotask/entities/tickets.ts#L104) | `setNotify(id, on)` → `autotask.update("Tickets", { id, userDefinedFields:[{ name:"Kunde benachrichtigen", value: on?"Ja":"Nein" }] })`. |
| Entity | [lib/autotask/entities/ticket-notes.ts:46](../lib/autotask/entities/ticket-notes.ts#L46) | `create` → `POST Tickets/{id}/Notes` (Eltern-Pfad; Top-Level `TicketNotes` = 404). |
| Konfig | [lib/autotask/conversation.ts](../lib/autotask/conversation.ts) | `CONVERSATION_NOTE_TYPES = { outbound:18, inbound:101 }`; `NOTIFY_UDF = { name:"Kunde benachrichtigen", yes:"Ja", no:"Nein" }`; `directionOf()` = inbound, wenn `noteType===101` **oder** `createdByContactID` gesetzt. |

**Schalter an/aus heute:** Der `notify`-Wert steuert **nur** den UDF-Wert (Ja/Nein),
**kein** API-Notify-Feld (die REST-API hat keins, DECISIONS V1). „AUS" würde das UDF
auf „Nein" setzen; die Notiz (noteType 18) entsteht in beiden Fällen.
**ABER:** Es gibt in der UI **keinen** Schalter – `notify` ist immer `true`.

### 1.2 Mail-/Resend-Integration im Repo?

**Nein.** Kein `resend`/`nodemailer`/`@react-email`/SMTP-Code, keine `RESEND_*`-Env,
kein Feature-Flag-Mechanismus für Mailversand. Treffer auf „resend" stammen
ausschließlich aus Doku (`docs/*`, `DEPLOY.md`) und `package-lock.json`
(Transitiv-Rauschen), nicht aus `app/`, `lib/` oder `components/`.

### 1.3 Env-Variablen (nur Namen) + AUTH_MODE

In `.env.local` gesetzt (Werte bewusst nicht zitiert):
`AUTH_MODE` (= **mock**), `AUTOTASK_BASE_URL`, `AUTOTASK_API_USERNAME`,
`AUTOTASK_API_SECRET`, `AUTOTASK_INTEGRATION_CODE`, `ENTRA_CLIENT_ID`,
`ENTRA_CLIENT_SECRET`, `ENTRA_TENANT_ID`, `AUTH_SECRET`, `NEXTAUTH_URL`,
`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

- **Kein** `RESEND_API_KEY` / `RESEND_FROM` / Mailbox-Variable vorhanden → muss für
  B17 neu angelegt werden.
- **Nebenbefund (nicht B17, aber notieren):** Die Entra-Namen in `.env.local`
  (`ENTRA_CLIENT_ID/…SECRET/…TENANT_ID`, `NEXTAUTH_URL`) weichen von `.env.example`
  ab, das `AUTH_MICROSOFT_ENTRA_ID_*` und `AUTH_URL`/`AUTH_TRUST_HOST` vorgibt. Für
  B17 irrelevant, aber vor dem Entra-Cutover (B16a) zu prüfen.

---

## 2. Historische Inbound-Daten (Sandbox = Prod-Kopie)

> Methode: `TicketNotes/query` + `query/count` gegen den App-Sandbox-Mandanten.
> Titel-Stichproben wurden gelesen; im Bericht werden **keine echten Inhalte/Namen
> zitiert**, nur Muster (Token-Form, „AW:"-Präfix).

### 2a. noteType-Verteilung (alle TicketNotes, exakte Counts)

**Gesamt: 209.639 TicketNotes.**

| noteType | Bedeutung | Anzahl |
|---:|---|---:|
| 99 | RMM-Notiz | 105.217 |
| 13 | Notiz für Workflow-Regel | 56.394 |
| 2 | Aufgabendetails | 22.506 |
| 94 | Anderes Ticket aufgenommen | 8.063 |
| 93 | In Ticket zusammengelegt | 5.239 |
| 3 | **Aufgabennotizen** | **4.104** |
| 1 | Zusammenfassung | 3.208 |
| 92 | weiterleiten/ändern | 2.873 |
| 100 | BDR-Notiz | 1.001 |
| 15 | Ticketduplikat | 853 |
| **18** | **Kundenportal-Notiz** | **162** |
| 91 | WF-Aktionsnotiz | 15 |
| 95 | In Projekt kopiert | 4 |
| **101** | **Email Note** | **0** |
| 16/17/19 | — | 0 |

**Fazit 2a:** Die Historie **widerlegt** „Inbound = 101". `noteType 101` kommt im
gesamten Mandanten **kein einziges Mal** vor (deckt sich mit DECISIONS V2/B10, ist
jetzt aber mandantenweit belegt, nicht nur an Einzeltickets).

### 2b. Wie sieht Kundenkommunikation tatsächlich aus?

Diskriminator „vom Kunden erstellt" = **`createdByContactID` gesetzt**.

- **Kunden-erstellte Notizen gesamt: 2.865.**
- Aufschlüsselung nach noteType (Count):

  | noteType | kunden-erstellt (`createdByContactID` gesetzt) | intern/Resource |
  |---:|---:|---:|
  | 3 (Aufgabennotizen) | **2.715** | 1.389 |
  | 18 (Kundenportal) | **150** | 12 |
  | 1 / 2 | 0 | 3.208 / 22.506 |
  | 101 | 0 | 0 |

- 500er-Stichprobe der kunden-erstellten Notizen: `noteType` **3 = 465, 18 = 35**;
  davon **267/500** mit Betreff im Muster `AW:`/`WG:`/`Re:` (= Mail-Antwort/-Weiterleitung).
- Betreff-Präfix-Counts (alle Notizen): `AW:` = **1.032** (davon **976**
  kunden-erstellt), `WG:` = 54, `Re:` = 1.

**Felder einer Inbound-Notiz (Stichprobe):** `createdByContactID` = gesetzt (der
antwortende Kontakt), `creatorResourceID` = leer, `publish` = 1, `noteType` = 3.
Der `title` ist der **Mail-Betreff**.

**Fazit 2b – das zentrale Ergebnis:** Eingehende Kundenmails/-antworten landen in
diesem Mandanten als **`noteType 3` (Aufgabennotizen) mit gesetztem
`createdByContactID`** – nicht als 101 und nicht als 18. Da `noteType 3` aber auch
**intern** genutzt wird (1.389 Resource-Notizen), ist **`noteType` allein kein
brauchbarer Inbound-Diskriminator**; der zuverlässige Diskriminator ist
**`createdByContactID` gesetzt**. Genau diese Notizen holt der Chat heute **nicht**
(`byTicketTypes` filtert hart auf `noteType ∈ {18,101}`).

### 2b-Threading. Betreff-/Token-Format (für Reply-To-Strategie)

Zwei beobachtete Formen in den Betreffzeilen:

1. **Mit Token:** `[Ticket#2022050303020793]   – Ihr Ticket wurde entgegengenommen`
   – Form **`[Ticket#<16 Ziffern>]`** (180 Notizen tragen `[Ticket#…]`). Die 16
   Ziffern sind **Autotask-generiert** (sehen aus wie `JJJJMMTT`+Sequenz) und sind
   **NICHT** die `id` (z. B. 16458) und **NICHT** die `ticketNumber`
   (`T2022…`). Antworten mit erhaltenem Token sind als `noteType 3`,
   `createdByContactID` am richtigen Ticket gelandet → **Autotask threadet über
   diesen eigenen Token.**
2. **Ohne sichtbaren Token:** `AW:  – Ihr Ticket wurde entgegengenommen` bzw.
   `AW: … auf Ticket:` (Betreff im `title` ohne Nummer) – trotzdem korrekt
   gethreadet. Threading lief hier also über **etwas anderes** als den sichtbaren
   Betreff (vermutlich die **Reply-To-/Empfänger-Mailbox** bzw. Mail-Header).

**Fazit Threading:** Autotask threadet eingehende Antworten über einen **selbst
erzeugten `[Ticket#…]`-Token im Betreff** und/oder die **Empfänger-Mailbox** – beides
**nicht** über die menschenlesbare Ticketnummer und beides von uns **nicht frei
reproduzierbar**. Das ist für B17 entscheidend (siehe Risiken).

### 2c. Per Mail erstellte Tickets (`source = 4`)

- **7.243 Tickets** mit `source = 4` (E-Mail) → der Mail-zu-Ticket-Weg („Add Ticket
  Email Service") ist in diesem Mandanten **aktiv genutzt**.
- Stichprobe (id/Nummer/Firma/Kontakt): Betreff = E-Mail-Subject (z. B.
  „Neues Notebook …", „Outlook lässt sich nicht öffnen"). `contactID` mal gesetzt,
  mal leer (unbekannter Absender).
- Ein Beispiel-Mailticket (id 8253) trug nur zwei **Resource**-Notizen (`noteType 2`,
  „Service Desk-Benachrichtigung"), keine Kunden-Notiz → die ursprüngliche Mail wird
  beim **Erstellen** zur Ticket-Beschreibung (nicht zwingend als separate Notiz);
  erst **Antworten** auf laufende Tickets erscheinen als `noteType 3`-Kundennotizen.

**Abgrenzung:** Mail **erstellt Ticket** = `source 4` (Subject → Titel/Description).
Mail **antwortet auf Ticket** = `noteType 3` + `createdByContactID` (Betreff = `AW: …`).

### Fazit Abschnitt 2 – ist B17a damit bestätigt?

**Nein, im Gegenteil – und genau das ist der Wert dieser Aufnahme.** Bestätigt aus
Daten:

- ✅ Inbound = **`noteType 3` + `createdByContactID`**, **nicht 101** (mandantenweit
  belegt, 976 „AW:"-Beispiele).
- ✅ `noteType 101` existiert hier nicht.
- ✅ Threading läuft über Autotask-eigenen `[Ticket#…]`-Token / Mailbox, nicht über
  die Ticketnummer.

**Rest für den Prod-Test (B17a, präzisiert):**

1. Kommt eine **frische** Kundenantwort in **Prod 2026** ebenfalls als `noteType 3` +
   `createdByContactID` an? (Historische Daten sind von 2021/22; Autotask hat das
   Mail-Processing über die Jahre geändert. Sehr wahrscheinlich, aber nicht garantiert.)
2. **Threadet Autotask eine Antwort auf eine von UNS (Resend) versendete Mail
   überhaupt?** – ohne den Autotask-`[Ticket#…]`-Token. Das ist **nicht aus
   historischen Daten ableitbar** und der eigentliche B17-Knackpunkt.

---

## 3. Autotask-Mailbox / „Add Ticket Email Service" per API?

**Nicht auslesbar.** `entityInformation`-Probe:

| Kandidat-Entität | HTTP |
|---|---|
| `WorkflowRules`, `WorkflowRule` | 404 |
| `InboundEmail`, `EmailService`, `TicketEmailService` | 404 |
| `NotificationHistory` | 200 |
| `CompanyAlerts` | 200 |

`NotificationHistory` ist abfragbar (Felder u. a. `recipientEmailAddress`,
`notificationSentTime`, `notificationHistoryTypeID`, `entityNumber`), enthält im
**Sandbox-Mandanten aber nur 4 Datensätze** – die ausgehenden Prod-Benachrichtigungen
sind hier **nicht** mitkopiert. Damit lässt sich weder die **Inbound-Mailbox-Adresse**
noch die **Absenderadresse** der heutigen Autotask-Mails per API ermitteln.

→ **Inbound-Mailboxadresse (= späteres Reply-To) ist eine Paul-Frage.**

---

## 4. Alte Workflow-Regel „Kunde benachrichtigen" per API prüfbar?

**Nein.** Workflow-Regeln sind nicht als REST-Entität exponiert (`WorkflowRules` =
404). Ob die Regel in der Sandbox/Prod **aktiv** ist, ist per API **nicht**
feststellbar.

**Aber das UDF selbst ist bestätigt:** `Tickets/entityInformation/userDefinedFields`
zeigt **`Kunde benachrichtigen`** als **Picklist mit genau `Ja` | `Nein`**,
`isRequired=false` (eines von 2 UDFs auf Tickets). Der Code schreibt also in ein real
existierendes Feld mit gültigen Werten.

→ **Regel-Status + Deaktivierung beim Cutover ist eine Paul-Frage** (sonst
Doppel-Mails: Resend **und** Workflow).

---

## 5. Fragenliste an Paul

**A — Resend / Versand**
1. **Absenderdomain/-adresse:** Welche Domain/Adresse ist in **Resend verifiziert**
   (SPF/DKIM)? Was soll als `From` stehen (z. B. `service@ssig-it.com` oder
   `tickets@…`)? Anzeigename?
2. **Resend-API-Key:** bitte als `RESEND_API_KEY` in `.env.local` (Sandbox-Test) und
   später Prod hinterlegen. Test-Key vs. Live-Key?
3. Soll der **Anzeigename des sendenden Technikers** in der Mail erscheinen
   (z. B. „Max von SSIG-IT") oder einheitlich „SSIG-IT Service Desk"?

**B — Autotask Inbound / Threading (kritisch)**
4. **Inbound-Mailboxadresse** (das Postfach von „Add Ticket Email Service") – das
   wird unser **`Reply-To`**. Wie lautet sie exakt?
5. **Wie threadet Autotask Antworten?** Reicht die Mailbox als `Reply-To`, oder muss
   ein bestimmter **Betreff-Token** enthalten sein? Historisch sahen wir
   `[Ticket#<16 Ziffern>]` (Autotask-generiert). **Akzeptiert die Inbound-Verarbeitung
   auch die normale Ticketnummer `T2026…` im Betreff?** (Diese Frage entscheidet, ob
   B17-Threading ohne Autotask-Token funktioniert – ggf. Prod-Test nötig, B17a.)
6. Gibt es pro Ticket eine **eindeutige Reply-To-Alias-Adresse** (z. B.
   `…+T2026…@…`), über die Autotask zuordnet? Falls ja: Format?

**C — Cutover / Workflow**
7. **Workflow-Regel „Kunde benachrichtigen"**: in Prod **aktiv**? Beim Umschalten auf
   Resend muss sie **deaktiviert** werden (sonst Doppel-Mail). Wer macht das, und
   wollen wir das UDF-Setzen im Code dann ersatzlos entfernen?
8. Soll das Ticket-UDF „Kunde benachrichtigen" **bestehen bleiben** (z. B. als
   Anzeige/Audit) oder mit B17 ganz aus dem Sende-Pfad raus?

**D — Produkt/Verhalten**
9. Aktuell hat die Chat-UI **keinen** „Kunde benachrichtigen"-Schalter (immer an).
   Mit B17 ohne UDF: Soll **jede** Chat-Nachricht eine Mail auslösen, oder kommt der
   Schalter (Mail an/aus pro Nachricht) wieder in die UI?
10. **Anhänge:** Sollen Chat-Mails Anhänge mitschicken (später) oder reiner Text/HTML?
11. **Inbound-Anzeige:** Dürfen wir den Chat so anpassen, dass er Kundennotizen über
    `createdByContactID` (statt nur `noteType 18/101`) zeigt? (Behebt, dass echte
    Antworten heute unsichtbar wären – betrifft B10/B17a-Code.)

---

## 6. Architektur-Skizze B17 (Vorschlag, kein Code)

### 6.1 Einhängepunkt

In [lib/autotask/entities/ticket-chat.ts](../lib/autotask/entities/ticket-chat.ts)
`sendTicketChatNote` umbauen; Reihenfolge **umdrehen** gegenüber heute:

1. **Notiz zuerst** anlegen (`ticketNotes.create`, `noteType 18, publish 1`) – die
   Notiz ist die Quelle der Wahrheit am Ticket und muss immer entstehen.
2. **Danach** bei `notify === true` **Resend-Mail** über ein neues, server-only
   `lib/mail/resend.ts` versenden (Empfänger = Ticket-Kontakt-Mail; Auflösung über
   `contactID` → `Contacts`).
3. **`tickets.setNotify` / UDF-Logik entfernen**; `NOTIFY_UDF` kann raus, sobald die
   Workflow-Regel deaktiviert ist.

Neue Env: `RESEND_API_KEY`, `RESEND_FROM`, `AUTOTASK_INBOUND_MAILBOX` (= `Reply-To`).

### 6.2 Mailinhalt / Betreff / Reply-To

- **Empfänger:** Mail des Ticket-Kontakts (`Contacts.emailAddress`); Guard: ohne
  Kontakt-Mail keine Mail (Notiz bleibt, UI-Hinweis).
- **Betreff:** Ticketnummer mitführen, im **gefundenen** Muster. Da der echte
  Autotask-Token `[Ticket#…]` nicht reproduzierbar ist, Vorschlag:
  `[Ticket# <ticketNumber>] <Titel>` und **zusätzlich** auf `Reply-To` =
  Inbound-Mailbox setzen. **Welche Variante wirklich threadet, MUSS der Prod-Test
  (B17a) zeigen** (Frage 5/6).
- **Reply-To:** `AUTOTASK_INBOUND_MAILBOX`. (`From` = verifizierte Resend-Domain.)
- **Body:** schlankes, brandfreundliches HTML + Text-Fallback; Ticketnummer + Inhalt
  der Notiz; Signatur „SSIG-IT Service Desk".

### 6.3 Fehlersemantik (wichtig)

- **Notiz scheitert** → Abbruch, Fehler an UI, **keine** Mail (nichts passiert ist
  sauber). Heutiges Verhalten bleibt.
- **Notiz ok, Mail scheitert** → **Notiz bleibt bestehen** (am Ticket dokumentiert),
  aber UI muss **klar** melden „Nachricht gespeichert, aber E-Mail nicht zugestellt"
  (kein stilles Schlucken; ggf. Retry-Button). Genau hier ist Resend besser als heute:
  der Versand ist **synchron prüfbar** (kein blindes UDF/Workflow-Race).
- **Idempotenz/Doppelversand:** `withTicketLock` beibehalten; bei Mail-Retry nicht
  erneut die Notiz anlegen.

### 6.4 Feature-Flag bis B17a final bestätigt

`MAIL_PROVIDER = autotask | resend` (Env). Default zunächst `autotask` (heutiges
Verhalten), Umschalten auf `resend` erst nach Prod-Test. So bleibt der Cutover eine
**eine-Variable-Entscheidung** und ist reversibel.

### 6.5 UDF-Logik-Rückbau

Erst **nachdem** (a) Resend in Prod threadet **und** (b) die Workflow-Regel
deaktiviert ist: `setNotify`-Aufruf + `NOTIFY_UDF` aus `conversation.ts`/`tickets.ts`
entfernen. Vorher nur hinter dem Flag „resend" überspringen, nicht löschen.

### 6.6 Inbound-Anzeige mitziehen (B17a-Code, eng verwandt)

Unabhängig vom Versand: Der Chat zeigt heute keine echten Kundenantworten, weil
`byTicketTypes` auf `noteType {18,101}` filtert, Antworten aber `noteType 3` sind.
Empfehlung (nach Paul-Frage 11): Inbound über **`createdByContactID` gesetzt** holen/
erkennen statt über die noteType-Whitelist. `directionOf()` kann das bereits – nur der
**Fetch-Filter** ist zu eng.

---

## 7. Risiken (ehrlich)

1. **Threading-Bruch (höchstes Risiko).** Autotask threadet über einen **selbst
   erzeugten Token** und/oder die Mailbox – **nicht** über die Ticketnummer, die wir
   setzen können. Wenn Autotasks Inbound-Parser **nur** seinen eigenen Token
   akzeptiert, landen Antworten auf unsere Resend-Mails als **neues Ticket** statt am
   bestehenden. **Muss in Prod getestet werden, bevor B17 scharf geschaltet wird.**
   Fallback, falls es nicht threadet: pro Ticket eine eindeutige Reply-To-Alias
   (Frage 6) oder Beibehalt einer minimalen Autotask-Benachrichtigung nur zur
   Tokenerzeugung.
2. **Inbound unsichtbar (bereits heute real).** Kundenantworten (`noteType 3`)
   erscheinen aktuell **nicht** im Chat. Das ist ein bestehender Funktionsfehler,
   nicht erst ein B17-Thema – mit Resend fällt er nur stärker auf.
3. **Doppel-Mail beim Cutover.** Bleibt die Workflow-Regel aktiv, während Resend
   sendet, bekommt der Kunde **zwei** Mails. Reihenfolge: erst Regel deaktivieren
   (Paul), dann Flag auf `resend`.
4. **Zustellbarkeit/Domain.** Ohne verifizierte Resend-Domain (SPF/DKIM/DMARC) landen
   Mails im Spam. From-Domain und Inbound-Mailbox sollten zur selben Domain-Familie
   passen.
5. **Sandbox kann B17 nicht voll beweisen.** Kein echtes Inbound in der Sandbox
   (NotificationHistory hat 4 Einträge, kein 101, kein frisches Inbound). Der
   Threading- und noteType-Beweis ist **zwingend Prod** (B17a) – an einem Testticket
   der Testfirma mit einer echten, kontrollierten Antwortadresse.
6. **Datenschutz beim Test.** Prod-Test nur mit eigener/kontrollierter Mailadresse,
   nicht an echten Fremdkontakten (analog Sandbox-Testregel).

---

## 8. Methode / Reproduzierbarkeit

Alle Zahlen über read-only Calls gegen den App-Sandbox-Mandanten
(`node --env-file=.env.local …`), Muster wie in `scripts/verify-api.mjs`:

- `POST {Entity}/query/count` mit `Filter` (noteType-Counts, source=4, Authorship via
  `{op:"exist"|"notExist", field:"createdByContactID"}`).
- `POST TicketNotes/query` mit `IncludeFields` **ohne** `description` (nur Metadaten +
  `title`), `MaxRecords ≤ 500`.
- `GET Tickets/entityInformation/userDefinedFields` (UDF-Definition).
- `GET {Entity}/entityInformation` (Erreichbarkeits-Probe 200/404).

Die Wegwerf-Probe-Skripte wurden nach dem Lauf wieder entfernt (kein Repo-Residuum);
nichts an Autotask-Daten, UDF oder Workflow wurde geändert.
