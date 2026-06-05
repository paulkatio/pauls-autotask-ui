# Phase 0 – API-Verifikation (Backlog-Item B00)

**Das ist die allererste Aufgabe. Vor B00 wird nichts gebaut.**

Ziel: Die im Blueprint markierten Unsicherheiten gegen die **echte Autotask-
Sandbox** prüfen, damit der spätere Code auf Fakten statt auf Annahmen steht.
Alle Ergebnisse trägst du in `docs/DECISIONS.md` ein.

Die Sandbox ist sicher nutzbar. Test-Schreibvorgänge sind erlaubt, solange du sie
in der Sandbox machst und protokollierst. Räume Test-Datensätze nach Möglichkeit
wieder auf (oder markiere sie eindeutig als Test).

Du kannst die Aufrufe entweder über ein kleines Throwaway-TypeScript-Skript
(`scripts/verify-api.ts`) machen oder über `curl`. Wichtig ist nur: echte
Aufrufe, echte Ergebnisse, dokumentiert.

---

## Voraussetzung

`.env.local` ist mit den Sandbox-Zugangsdaten gefüllt (siehe `.env.example`).
Falls Werte fehlen, **stoppe und frage Paul**, statt zu raten.

Verbindungstest zuerst: ein einfacher `GET` auf einen Zone-/Version-Endpunkt bzw.
ein `Tickets/query` mit `MaxRecords: 1`. Erst wenn das antwortet, weiter.

---

## V1 – TicketNotes: Felder & E-Mail-Verhalten (BLOCKER)

Das ist der wichtigste Punkt, weil die ganze Chat-Sidebar daran hängt.

1. `GET TicketNotes/entityInformation/fields` – vollständige Feldliste abrufen.
2. Picklists ziehen für `noteType` und alles, was nach Sichtbarkeit/Publish
   aussieht (`publish` o. Ä.). Alle möglichen Werte + ihre Labels notieren.
3. **Test-Notizen anlegen** an einem Test-Ticket der Sandbox, mit verschiedenen
   Kombinationen aus `noteType` und `publish`.
4. Nach jeder Test-Note prüfen:
   - Taucht in `NotificationHistory` (gefiltert auf die TicketID) ein
     Versand-Eintrag auf?
   - Wird tatsächlich eine E-Mail an den Ticket-Kontakt zugestellt? (Sandbox-
     Postfach prüfen, falls erreichbar – sonst NotificationHistory als Beleg.)

**In DECISIONS.md festhalten:**
- Welche `noteType`/`publish`-Kombination löst einen E-Mail-Versand aus?
- Welche bleibt rein intern (keine Mail)?
- Falls **keine** Kombination automatisch eine Mail auslöst: festhalten, dass der
  E-Mail-Versand von einem **Autotask-Workflow** abhängt, der separat konfiguriert
  werden muss (kein Code-Problem, sondern Autotask-Konfiguration).

---

## V2 – Eingehende E-Mails -> TicketNotes (BLOCKER)

Prüfen, ob Antworten eines Kontakts per E-Mail in der Sandbox als neue
TicketNotes erscheinen (Incoming E-Mail Processing).

- Falls aktiv: Verzögerung und resultierenden `noteType` notieren.
- Falls nicht eingerichtet: festhalten, dass Inbound für die Sandbox nicht
  belegbar ist und in Produktion über Autotask-Mailprozesse läuft. Die UI muss
  damit umgehen können (Polling der TicketNotes, kein Echtzeit-Versprechen).

---

## V3 – TimeEntries: lesbar? schreibbar? (BLOCKER für Schreiben)

1. `GET TimeEntries/entityInformation/fields` – Feldliste.
2. `TimeEntries/query` für ein Ticket – Lesen bestätigen, relevante Felder
   notieren (Dauer, Datum, Resource, Beschreibung, abrechenbar?).
3. **Test:** Lässt sich ein TimeEntry per `POST` anlegen? Lässt er sich
   posten/genehmigen (post/approve) per API, oder ist das nur in der Autotask-UI
   möglich?

**In DECISIONS.md:** Lesen = ja/nein, Anlegen = ja/nein, Post/Approve = ja/nein.
Daraus ergibt sich, ob Zeiterfassung im MVP (read-only) oder erst später
(Should-have) landet.

---

## V4 – Webhooks-Verfügbarkeit (BLOCKER für Near-Realtime)

1. Verfügbare Webhook-Entitäten im Sandbox-Tenant auflisten (insb. ob
   Ticket- und TicketNote-Webhooks existieren).
2. Falls vorhanden: einen Test-Webhook auf einen temporären Endpunkt
   konfigurieren (z. B. einen Request-Bin-Dienst) und Payload-Struktur notieren.

**In DECISIONS.md:** Webhooks für TicketNotes verfügbar = ja/nein. Wenn nein:
Chat-Sidebar bleibt **Polling-basiert** (das ist der MVP-Plan ohnehin – kein
Blocker für den MVP, aber für "Nice-to-have Realtime" entscheidend).

---

## V5 – Felder für Listen, Filter, KPIs

Damit Dashboard und Listen nicht raten müssen:

1. `GET Tickets/entityInformation/fields` – Feldliste.
2. Picklists für `status`, `priority`, `queueID` ziehen (Werte + Labels) und in
   DECISIONS.md ablegen – diese Mappings braucht die UI für lesbare Anzeige.
3. Existenz und genaue Namen der Felder bestätigen, die das Dashboard nutzen will:
   - `assignedResourceID` (für "Meine Tickets")
   - `queueID` / ggf. `departmentID` (für "Teamtickets")
   - Fälligkeit (`dueDateTime` o. Ä.), `completedDate`, `lastActivityDate`
   - SLA-relevante Felder (Name in Sandbox verifizieren)
4. Filter-Syntax bestätigen: `Tickets/query` mit JSON-Filter (`eq`, `gte`, `lte`)
   und Paging über `pageDetails.nextPageUrl`. Einen echten gefilterten + gepagten
   Aufruf machen und das Antwortformat notieren.

---

## V6 – Resource-Mapping & Rate-Limit

1. `Resources/query` – wie finde ich zu einem User (Mail/UPN) die
   `resourceID`? (Wird für `autotaskResourceId` im SessionUser gebraucht.)
   Mindestens für die paar Sandbox-Resources das Mapping Mail -> ID notieren –
   das speist später den Mock-User-Umschalter.
2. Tatsächliches Rate-Limit-Verhalten grob beobachten (nicht provozieren):
   reagiert die Sandbox wie dokumentiert (10k/60min, 3 Threads/Tabelle)? Wenn ein
   `429` auftaucht, Header/Reason notieren.

---

## Abschluss von Phase 0

Phase 0 ist erst fertig, wenn `docs/DECISIONS.md` zu **jedem** Punkt V1–V6 einen
klaren Eintrag hat (auch "nicht möglich / Workaround" ist ein gültiger Eintrag).

Danach – und erst danach – fängst du mit B01 aus `docs/BACKLOG.md` an.

Wenn ein Blocker (V1, V2, V3 oder V4) ein Ergebnis liefert, das den Blueprint
umwirft (z. B. TicketNotes lösen prinzipiell keine Mails aus und es gibt keinen
Workflow), dann **stoppe und melde es Paul mit deinem Vorschlag**, statt eigenmächtig
eine andere Richtung einzuschlagen.
