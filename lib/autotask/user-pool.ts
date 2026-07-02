import "server-only";

// Autotask-API-User-Pool (Phase B). Zweck: (a) Ausfallsicherheit — der bisherige
// EINE API-User war ein Single Point of Failure; (b) höherer Durchsatz — jeder Member
// ist ein EIGENER Autotask-Login MIT EIGENEM Integration-Code, also ein getrenntes
// 3-Thread-Budget pro Objekt-Endpoint (gilt unter beiden dokumentierten Lesarten des
// Limits: pro Integration ODER pro Login — beide unterscheiden sich über die Member).
//
// Feature-Flag AUTOTASK_POOL_ENABLED: DEFAULT AUS. Aus → nur Member 1 (Primär), der
// Gate-Key bleibt die Entität, Verhalten exakt wie vor Phase B. An → alle konfigurierten
// Member, Gate-Key wird `member:entity` (getrennte Budgets), Reads werden verteilt.
//
// Secrets/Codes bleiben server-only. Der Member-`id` ist ein STABILER Alias ("1"/"2"/"3")
// für Keys, Logs und Health — niemals das Secret.

export interface PoolMember {
  id: string; // stabiler Alias, nie das Secret — für Gate-Keys/Health/Logs
  username: string;
  secret: string;
  integrationCode: string;
  isPrimary: boolean; // genau einer; einziger erlaubter Schreib-User
}

export const poolEnabled =
  process.env.AUTOTASK_POOL_ENABLED === "1" ||
  process.env.AUTOTASK_POOL_ENABLED === "true";

// Member aus den (nummerierten) Env-Vars lesen. Member 1 = die UNSUFFIXIERTEN Vars
// (= Primär, heutiger Betrieb, einziger Schreib-User). 2/3 optional.
function readMembers(): PoolMember[] {
  const e = process.env;
  const defs = [
    {
      id: "1",
      u: e.AUTOTASK_API_USERNAME,
      s: e.AUTOTASK_API_SECRET,
      c: e.AUTOTASK_INTEGRATION_CODE,
      primary: true,
    },
    {
      id: "2",
      u: e.AUTOTASK_API_USERNAME_2,
      s: e.AUTOTASK_API_SECRET_2,
      c: e.AUTOTASK_INTEGRATION_CODE_2,
      primary: false,
    },
    {
      id: "3",
      u: e.AUTOTASK_API_USERNAME_3,
      s: e.AUTOTASK_API_SECRET_3,
      c: e.AUTOTASK_INTEGRATION_CODE_3,
      primary: false,
    },
  ];
  return defs
    .filter((d) => d.u && d.s && d.c)
    .map((d) => ({
      id: d.id,
      username: d.u as string,
      secret: d.s as string,
      integrationCode: d.c as string,
      isPrimary: d.primary,
    }));
}

// Aktive Member: Pool an → alle konfigurierten; Pool aus → nur Primär (Member 1).
// Bei fehlendem Member 1 leer → der Aufrufer wirft „Creds fehlen" (wie bisher).
const configured = readMembers();
const activeMembers: PoolMember[] = poolEnabled
  ? configured
  : configured.filter((m) => m.isPrimary);

// --- Health (prozess-lokal) -------------------------------------------------
// 429/Threshold ist objekt-endpoint-spezifisch → nur `member:entity` kurz krank.
// 401 (ungültige Credentials) → GANZER Member länger krank. Bewusst pro Prozess
// (einfach); über Vercel-Instanzen nicht geteilt — als Betriebs-Heuristik ok, das
// 429-Backoff im Client bleibt das harte Netz.
const SCOPE_COOLDOWN_MS = 10_000; // 429: member+entity
const MEMBER_COOLDOWN_MS = 60_000; // 401: ganzer Member

const scopeDownUntil = new Map<string, number>(); // key `${id}:${entity}`
const memberDownUntil = new Map<string, number>(); // key `${id}`

// Uhr injizierbar (Tests). Kein Date.now() im Modul-Scope.
function healthyForEntity(m: PoolMember, entity: string, now: number): boolean {
  return (
    (memberDownUntil.get(m.id) ?? 0) <= now &&
    (scopeDownUntil.get(`${m.id}:${entity}`) ?? 0) <= now
  );
}

const poolDebug = process.env.AUTOTASK_POOL_DEBUG === "1";

export function markRateLimited(id: string, entity: string, now = Date.now()): void {
  if (poolDebug) console.log(`[pool-mark] 429 member=${id} entity=${entity}`);
  scopeDownUntil.set(`${id}:${entity}`, now + SCOPE_COOLDOWN_MS);
}

export function markAuthFailed(id: string, now = Date.now()): void {
  if (poolDebug) console.log(`[pool-mark] 401 member=${id}`);
  memberDownUntil.set(id, now + MEMBER_COOLDOWN_MS);
}

// --- Auswahl ----------------------------------------------------------------
let rrCounter = 0;

export interface PickResult {
  member: PoolMember | null;
  // allDownAuth: alle (aktiven) Member sind wegen 401 unten → fail-fast statt hämmern.
  allDownAuth: boolean;
}

// Lese-Member: Round-Robin über die für DIESE Entität gesunden Member. Sind alle
// krank: unterscheide Ursache — nur 401 überall → fail-fast (member=null,
// allDownAuth=true); sonst (429) fail-open → trotzdem einen zurückgeben (Backoff greift).
export function pickReadMember(entity: string, now = Date.now()): PickResult {
  if (activeMembers.length === 0) return { member: null, allDownAuth: false };
  const healthy = activeMembers.filter((m) => healthyForEntity(m, entity, now));
  if (healthy.length > 0) {
    const m = healthy[rrCounter % healthy.length];
    rrCounter = (rrCounter + 1) % 1_000_000;
    return { member: m, allDownAuth: false };
  }
  // Keiner gesund. Ursache prüfen.
  const allAuth = activeMembers.every((m) => (memberDownUntil.get(m.id) ?? 0) > now);
  if (allAuth) return { member: null, allDownAuth: true };
  // 429-bedingt alle unten → fail-open: nimm den Primär (bzw. ersten) trotzdem.
  return { member: primaryMember() ?? activeMembers[0], allDownAuth: false };
}

// Schreib-Member: IMMER der Primär (Audit/History konsistent). Kein Failover auf einen
// Sekundär — Writes sind unumkehrbar (Notizen/Mails); lieber sichtbar scheitern als still
// unter fremdem Namen schreiben. Ist der Primär selbst 401-unten, meldet der Aufrufer das.
export function primaryMember(): PoolMember | null {
  return activeMembers.find((m) => m.isPrimary) ?? activeMembers[0] ?? null;
}

// Sichtbar für Diagnose/Verify (keine Secrets): welche Member aktiv, Pool an/aus.
export function poolInfo(): { enabled: boolean; memberIds: string[]; primaryId: string | null } {
  return {
    enabled: poolEnabled,
    memberIds: activeMembers.map((m) => m.id),
    primaryId: primaryMember()?.id ?? null,
  };
}
