import "server-only";

import { Redis } from "@upstash/redis";

// Instanzenübergreifender Concurrency-Limiter (verteilter Semaphore) über Upstash
// Redis. Autotask begrenzt auf 3 gleichzeitige Requests pro Objekt-Endpoint PRO
// INTEGRATION (global, nicht pro Prozess) → der reine In-Process-Limiter in
// limiter.ts kann das auf Vercel (mehrere Instanzen) nicht koordinieren. Dieser
// Semaphore tut es: alle Instanzen teilen sich pro Objekt eine Slot-Menge in Redis.
//
// Aktiv NUR, wenn UPSTASH_REDIS_REST_URL + _TOKEN gesetzt sind; sonst null/aus →
// der Client nutzt weiter den In-Process-Limiter (kein Bruch).

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export const globalLimiterEnabled = Boolean(URL && TOKEN);

let client: Redis | null = null;
function redis(): Redis {
  if (!client) client = new Redis({ url: URL!, token: TOKEN! });
  return client;
}

// Sicherheits-Marge unter dem Autotask-Limit (3) → 2 globale Slots pro Objekt.
const GLOBAL_LIMIT = 2;
// TTL eines belegten Slots: stirbt eine Instanz mitten im Call, läuft ihr Slot ab
// (kein Deadlock). Muss > Dauer EINES HTTP-Calls sein (Auto-Paging acquired je Seite
// neu) → 15 s sind reichlich.
const SLOT_TTL_MS = 15_000;
// Maximal so lange auf einen Slot warten; danach trotzdem durchlassen (das
// 429-Backoff im Client ist das Sicherheitsnetz – lieber durchlassen als hängen).
const MAX_WAIT_MS = 20_000;
const POLL_MS = 80;
const PREFIX = "at:sem:";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Atomar (Lua): abgelaufene Slots entfernen, dann – wenn unter Limit – eigenen Slot
// mit Ablaufzeit eintragen. ZSET-Score = Ablaufzeitpunkt. Rückgabe 1 = bekommen.
const ACQUIRE = `
local now = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local token = ARGV[3]
local expiry = tonumber(ARGV[4])
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now)
if redis.call('ZCARD', KEYS[1]) < limit then
  redis.call('ZADD', KEYS[1], expiry, token)
  redis.call('PEXPIRE', KEYS[1], 60000)
  return 1
end
return 0
`;

// Führt fn aus, sobald ein globaler Slot für `key` frei ist. Gibt den Slot danach
// IMMER frei (auch bei Fehler). Bei Redis-Problemen NICHT blockieren: durchlassen.
export async function globalRun<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const r = redis();
  const semKey = `${PREFIX}${key}`;
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const start = Date.now();
  let acquired = false;

  try {
    while (Date.now() - start < MAX_WAIT_MS) {
      const now = Date.now();
      let got: unknown;
      try {
        got = await r.eval(
          ACQUIRE,
          [semKey],
          [String(now), String(GLOBAL_LIMIT), token, String(now + SLOT_TTL_MS)],
        );
      } catch (e) {
        // Redis nicht erreichbar → nicht hängen bleiben, Aufruf durchlassen.
        console.warn(
          `[autotask] globaler Limiter (Redis) nicht erreichbar für ${key} – lasse durch.`,
          e instanceof Error ? e.message : e,
        );
        return await fn();
      }
      if (got === 1) {
        acquired = true;
        break;
      }
      await sleep(POLL_MS);
    }
    if (!acquired) {
      console.warn(
        `[autotask] globaler Limiter: Timeout für ${key} nach ${MAX_WAIT_MS}ms – lasse durch (429-Backoff als Netz).`,
      );
    }
    return await fn();
  } finally {
    if (acquired) {
      try {
        await r.zrem(semKey, token);
      } catch {
        // Slot läuft sonst per TTL ab – kein harter Fehler.
      }
    }
  }
}
