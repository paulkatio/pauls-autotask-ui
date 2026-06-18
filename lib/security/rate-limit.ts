import "server-only";

import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

// Anwendungs-Rate-Limit pro Identität (Session-User bzw. IP) und Route-Eimer.
//
// Zweck: schützt die BFF-Endpunkte vor Missbrauch durch einen angemeldeten
// Nutzer (oder eine gestohlene Session) – insbesondere teure Fan-out-Reads und
// die E-Mail-auslösenden Schreibpfade, die sonst das Autotask-Stundenlimit
// (10k/h) oder das Resend-Kontingent verbrennen könnten. Der bestehende
// Concurrency-Limiter (lib/autotask/*) begrenzt nur die Parallelität gegen
// Autotask, NICHT die Anfragerate je Nutzer.
//
// Verteilt über Upstash Redis (Sliding Window per Sorted Set), falls
// UPSTASH_REDIS_REST_URL/_TOKEN gesetzt sind – sonst sauberer In-Process-
// Fallback (pro Instanz). Bei Redis-Problemen: nicht blockieren, lokal werten.

const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const redisEnabled = Boolean(URL_ && TOKEN);

let client: Redis | null = null;
function redis(): Redis {
  if (!client) client = new Redis({ url: URL_!, token: TOKEN! });
  return client;
}

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  resetMs: number; // bis das Fenster wieder Luft hat (für Retry-After)
}

export interface RateLimitOptions {
  bucket: string; // logischer Eimer, z. B. "write", "email", "search"
  limit: number; // erlaubte Treffer pro Fenster
  windowMs: number; // Fensterlänge in ms
}

// ---- In-Process Sliding Window (Fallback / ohne Redis) -------------------

const localBuckets = new Map<string, number[]>();

function localCheck(
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): RateLimitResult {
  const cutoff = now - windowMs;
  const hits = (localBuckets.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= limit) {
    localBuckets.set(key, hits);
    return { ok: false, limit, remaining: 0, resetMs: hits[0] + windowMs - now };
  }
  hits.push(now);
  localBuckets.set(key, hits);
  // Gelegentliche GC, damit die Map nicht unbegrenzt wächst.
  if (localBuckets.size > 5000) {
    for (const [k, v] of localBuckets) {
      if (v.every((t) => t <= cutoff)) localBuckets.delete(k);
    }
  }
  return { ok: true, limit, remaining: limit - hits.length, resetMs: windowMs };
}

// ---- Verteiltes Sliding Window (Upstash Redis) ---------------------------

// Atomar (Lua): abgelaufene Treffer entfernen, zählen, ggf. eigenen Treffer
// eintragen. Rückgabe = verbleibendes Kontingent (>=0) oder -1 bei Überschreitung.
const SLIDING = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count < limit then
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, window)
  return limit - count - 1
end
return -1
`;

async function redisCheck(
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): Promise<RateLimitResult> {
  const member = `${now}-${Math.random().toString(36).slice(2)}`;
  const remaining = (await redis().eval(
    SLIDING,
    [key],
    [String(now), String(windowMs), String(limit), member],
  )) as number;
  if (remaining < 0) {
    return { ok: false, limit, remaining: 0, resetMs: windowMs };
  }
  return { ok: true, limit, remaining, resetMs: windowMs };
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  if (!redisEnabled) return localCheck(key, limit, windowMs, now);
  try {
    return await redisCheck(key, limit, windowMs, now);
  } catch {
    // Redis nicht erreichbar → nicht hängen/blocken, lokal werten.
    return localCheck(key, limit, windowMs, now);
  }
}

// Bequemer Wrapper für Route-Handler: liefert eine 429-Antwort bei
// Überschreitung, sonst null. `identity` ist die stabile Session-User-ID
// (Fallback: IP via clientIp(req)).
export async function enforceRateLimit(
  identity: string,
  opts: RateLimitOptions,
): Promise<NextResponse | null> {
  const key = `rl:${opts.bucket}:${identity}`;
  const res = await rateLimit(key, opts.limit, opts.windowMs);
  if (res.ok) return null;
  const retryAfter = Math.max(1, Math.ceil(res.resetMs / 1000));
  return NextResponse.json(
    { error: "Zu viele Anfragen – bitte kurz warten.", rateLimited: true },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(res.limit),
        "X-RateLimit-Remaining": "0",
      },
    },
  );
}

// Beste verfügbare Client-IP aus den Proxy-Headern (Fallback-Identität, wenn
// keine Session vorliegt – z. B. Login-Pfade).
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

// Sinnvolle Voreinstellungen je Eimer. Fenster bewusst kurz (Burst-Schutz), nicht
// als Tageskontingent gedacht.
export const RL = {
  // Lesende Endpunkte (Listen, Detail): großzügig, fängt nur Exzesse.
  read: { bucket: "read", limit: 120, windowMs: 60_000 },
  // Such-/Fan-out-Endpunkte: EIN Request fächert in mehrere Autotask-Calls auf
  // (Firma + Kontakt + Tickets, Auto-Paging) → enger als normale Reads, damit ein
  // Nutzer das 10k/h-Tenant-Limit nicht ausreizt.
  search: { bucket: "search", limit: 30, windowMs: 60_000 },
  // Schreibende Endpunkte (Felder ändern, Notiz, Zeiteintrag, Checkliste …).
  write: { bucket: "write", limit: 40, windowMs: 60_000 },
  // E-Mail-auslösende Pfade pro Absender (Zuweisungs-/Kundenmail): Spam-/Quota-Schutz.
  email: { bucket: "email", limit: 12, windowMs: 60_000 },
  // Zweite Schranke PRO EMPFÄNGER: schützt ein einzelnes Postfach davor, auch von
  // mehreren Absendern geflutet zu werden (Schlüssel = resourceId, nicht Session).
  emailRecipient: { bucket: "email-recipient", limit: 20, windowMs: 3_600_000 },
  // Irreversible Sammelaktion (Merge): sehr eng.
  merge: { bucket: "merge", limit: 8, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitOptions>;
