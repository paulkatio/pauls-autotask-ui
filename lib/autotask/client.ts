import "server-only";

import { createLimiter } from "@/lib/autotask/limiter";
import { RetryableError, backoffDelay } from "@/lib/autotask/backoff";
import { recordApiCall } from "@/lib/autotask/rate-monitor";
import { globalLimiterEnabled, globalRun } from "@/lib/autotask/global-limiter";
import {
  poolEnabled,
  pickReadMember,
  primaryMember,
  markRateLimited,
  markAuthFailed,
  type PoolMember,
} from "@/lib/autotask/user-pool";

// Zentrale, server-only Brücke zur Autotask REST API (BFF, CLAUDE.md §5).
// Generischer Kern: query / get / create / update. Entitätsspezifische Wrapper
// liegen in lib/autotask/entities/* (Erweiterbarkeitsprinzip, DECISIONS.md).
//
// Sicherheit: Base-URL/UserName/Secret/IntegrationCode kommen aus process.env und
// werden NIEMALS geloggt oder in Antworten/Fehlern an den Browser zurückgegeben.
// "server-only" verhindert, dass dieses Modul je ins Client-Bundle gelangt.

const MAX_CONCURRENCY_PER_ENTITY = 2; // Autotask: max 3/Tabelle; defensiv 2.
const MAX_PAGES = 50; // harte Obergrenze beim Auto-Paging.

// Concurrency-Drossel PRO BUDGET × Objekt. OHNE Pool = ein Budget (der eine API-User) →
// Key ist die Entität, „Tickets" defensiv auf 1/Prozess (heißeste Tabelle, löste die
// „Thread Threshold"-Alerts aus). MIT Pool hat JEDER Member ein eigenes 3-Thread-Budget
// (eigener Login + eigener Integration-Code) → Key wird `member:entity`, jeder Member
// darf die Default-2 fahren (bleibt unter seinen 3). Limiter pro Prozess; der globale
// Upstash-Semaphore koordiniert instanzenübergreifend über denselben Key.
const limiter = createLimiter(
  MAX_CONCURRENCY_PER_ENTITY,
  poolEnabled ? {} : { Tickets: 1 },
);

type RequestKind = "read" | "write";
const poolDebug = process.env.AUTOTASK_POOL_DEBUG === "1"; // opt-in Member-Selektions-Log
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Drosselung pro Aufruf: ZUERST der lokale Pre-Gate (pro Prozess, hält die Redis-Last
// niedrig + ist der Fallback), DANN – falls Upstash konfiguriert – der globale
// Semaphore. Der `key` ist bei aktivem Pool `member:entity`, sonst die Entität.
function gated<T>(key: string, fn: () => Promise<T>): Promise<T> {
  return limiter(key, () => (globalLimiterEnabled ? globalRun(key, fn) : fn()));
}

export type FilterOp =
  | "eq"
  | "noteq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "beginsWith"
  | "endsWith"
  | "in"
  | "exist"
  | "notExist"
  | "and"
  | "or";

export interface AutotaskFilter {
  op: FilterOp;
  field?: string; // entfällt bei Gruppen (and/or)
  value?: string | number | boolean | null | Array<string | number>;
  items?: AutotaskFilter[]; // verschachtelte Bedingungen für and/or
  udf?: boolean;
}

export interface QueryBody {
  MaxRecords?: number;
  IncludeFields?: string[];
  Filter: AutotaskFilter[];
}

export interface QueryOptions {
  autoPage?: boolean; // Default true
  maxItems?: number; // Obergrenze über alle Seiten
}

// Fehler ohne jegliche Credentials – nur Status + von Autotask gemeldete Messages.
export class AutotaskError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AutotaskError";
  }
}

// Erkennt ein Autotask-Rate-Limit (429) typunabhängig: sowohl den nach aussen
// gemappten AutotaskError(429) als auch – defensiv – einen noch nicht gemappten
// RetryableError(429). Für die 429-UI-Unterscheidung UND den späteren API-User-Pool
// (Member/Scope bei 429 als krank markieren, neu wählen).
export function isRateLimitError(err: unknown): boolean {
  return (
    (err instanceof AutotaskError && err.status === 429) ||
    (err instanceof RetryableError && err.status === 429)
  );
}

interface QueryResponse<T> {
  items: T[];
  pageDetails?: { nextPageUrl: string | null; prevPageUrl: string | null };
}

export interface TicketPage<T> {
  items: T[];
  nextPageUrl: string | null;
  prevPageUrl: string | null;
}

export interface PicklistValue {
  value: string;
  label: string;
  isActive: boolean;
  parentValue?: string; // bei abhängigen Picklists (z. B. subIssueType -> issueType)
}

export interface FieldInfo {
  name: string;
  dataType: string;
  isPickList: boolean;
  picklistValues: PicklistValue[] | null;
  // Optional (nicht jede Antwort liefert sie) – für Schreib-/Pflichtfeld-Gates.
  isRequired?: boolean;
  isReadOnly?: boolean;
}

function baseUrl(): string {
  const base = process.env.AUTOTASK_BASE_URL;
  if (!base) throw new Error("AUTOTASK_BASE_URL fehlt in der Umgebung.");
  return base.replace(/\/$/, "");
}

// Auth-Header für EINEN Pool-Member. Secrets bleiben server-only und tauchen nie in
// Logs/Antworten auf. Fehlende Creds werden vorher bei der Member-Auswahl abgefangen.
function authHeaders(member: PoolMember): Record<string, string> {
  return {
    ApiIntegrationCode: member.integrationCode,
    UserName: member.username,
    Secret: member.secret,
    "Content-Type": "application/json",
  };
}

// Kind-Collections sind in Autotask EIGENE Objekt-Endpoints und zählen für das
// Thread-Limit getrennt vom Parent. Der REST-Pfad führt aber über den Parent
// (`Tickets/{id}/Notes`), darum hier explizit aufs echte Objekt mappen — sonst
// würde ein Notiz-/Anhang-Write fälschlich aufs „Tickets"-Budget gebucht.
const CHILD_OBJECT_ENDPOINT: Record<string, string> = {
  "Tickets/Notes": "TicketNotes",
  "Tickets/Attachments": "TicketAttachments",
  "Tickets/ChecklistItems": "TicketChecklistItems",
  "Tickets/SecondaryResources": "TicketSecondaryResources",
};

// Schlüssel für den Concurrency-Limiter = der Autotask-Objekt-Endpoint, gegen den der
// Call zählt. Top-Level: erstes Pfadsegment (`Tickets/query` → „Tickets"). Kind-
// Collection `{Parent}/{id}/{Child}` → echtes Objekt (`Tickets/123/Notes` →
// „TicketNotes"); unbekannte Kind-Pfade fallen sicher auf den Parent zurück.
function entityKey(path: string): string {
  const rel = path.replace(/^https?:\/\/[^/]+\/[^/]+\/[^/]+\//i, "");
  const segs = rel.split("/").filter(Boolean);
  const parent = segs[0]?.split("?")[0] ?? rel;
  if (segs.length >= 3 && /^\d+$/.test(segs[1])) {
    const child = segs[2].split("?")[0];
    return CHILD_OBJECT_ENDPOINT[`${parent}/${child}`] ?? parent;
  }
  return parent;
}

function resolveUrl(pathOrUrl: string): string {
  return pathOrUrl.startsWith("http") ? pathOrUrl : `${baseUrl()}/${pathOrUrl}`;
}

// Ein einzelner HTTP-Aufruf mit Member-Wahl, Failover und 429-Backoff. Reads werden
// über die für die Entität GESUNDEN Pool-Member verteilt (Round-Robin), Writes gehen
// IMMER an den Primär. 429 markiert `member:entity` kurz als krank; der nächste Versuch
// wählt neu → Failover IN der Retry-Schleife. 401 markiert den ganzen Member: Reads
// versuchen sofort einen anderen, Writes scheitern strikt (kein fremder Schreiber).
const MAX_ATTEMPTS = 5; // 1 + 4 Retries (wie das bisherige withRetry retries=4)

async function request<T = unknown>(
  method: string,
  pathOrUrl: string,
  key: string,
  kind: RequestKind,
  body?: unknown,
): Promise<T> {
  let lastErr: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let picked: PoolMember | null;
    if (kind === "write" || !poolEnabled) {
      // Writes IMMER an den Primär. OHNE Pool gibt es nur Member 1 → direkt nehmen,
      // KEIN Health-Routing → exakt das Verhalten vor Phase B (Marks bleiben inert).
      picked = primaryMember();
    } else {
      const pick = pickReadMember(key);
      if (pick.allDownAuth) {
        // Alle Member wegen 401 unten → nicht weiter gegen kaputte Creds hämmern.
        throw new AutotaskError(
          401,
          "Alle Autotask-API-User wurden abgelehnt (401) – Konfiguration prüfen.",
        );
      }
      picked = pick.member;
    }
    if (!picked) throw new Error("Autotask-Zugangsdaten fehlen in der Umgebung.");
    const member = picked;

    const gateKey = poolEnabled ? `${member.id}:${key}` : key;
    if (poolDebug) {
      console.log(`[pool] ${kind} ${key} -> member ${member.id} (gate ${gateKey})`);
    }

    try {
      return await gated(gateKey, async () => {
        // Jeder echte HTTP-Versuch (inkl. Retries) zählt aufs 10k/h-Tenant-Limit.
        recordApiCall();
        const res = await fetch(resolveUrl(pathOrUrl), {
          method,
          headers: authHeaders(member),
          body: body ? JSON.stringify(body) : undefined,
          cache: "no-store",
        });

        if (res.status === 429) {
          markRateLimited(member.id, key); // member+entity kurz krank → Failover
          throw new RetryableError(429);
        }
        if (res.status === 401) {
          markAuthFailed(member.id); // ganzer Member krank (Login abgelehnt)
          throw new AutotaskError(401, "Autotask lehnte den API-User ab (401).");
        }

        const text = await res.text();
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          json = text;
        }

        if (!res.ok) {
          const errs = (json as { errors?: unknown })?.errors;
          const message = Array.isArray(errs)
            ? errs.join("; ")
            : `Autotask-Fehler (HTTP ${res.status})`;
          throw new AutotaskError(res.status, message);
        }

        return json as T;
      });
    } catch (err) {
      lastErr = err;
      const isLast = attempt === MAX_ATTEMPTS - 1;

      // 429: markiert → nächster Versuch wählt einen anderen (gesunden) Member. Backoff.
      if (err instanceof RetryableError && err.status === 429 && !isLast) {
        await sleep(backoffDelay(attempt, 500));
        continue;
      }
      // 401 bei READ MIT aktivem Pool: Member ist unten → sofort einen anderen Member
      // versuchen (kein Backoff). OHNE Pool (nur Member 1) oder bei WRITE (Primär, strikt)
      // NICHT failovern → durchwerfen (exakt wie vor Phase B: 401 sofort sichtbar).
      if (
        poolEnabled &&
        err instanceof AutotaskError &&
        err.status === 401 &&
        kind === "read" &&
        !isLast
      ) {
        continue;
      }
      throw err;
    }
  }

  // Versuche erschöpft: 429 nach aussen als AutotaskError(429) (UI-Unterscheidung +
  // isRateLimitError). Sonst den letzten Fehler durchreichen.
  if (lastErr instanceof RetryableError && lastErr.status === 429) {
    throw new AutotaskError(429, "Autotask-Rate-Limit (429) – Versuche erschöpft.");
  }
  throw lastErr;
}

export const autotask = {
  // POST {entity}/query mit Auto-Paging (pageDetails.nextPageUrl) bis maxItems/MAX_PAGES.
  async query<T>(
    entity: string,
    body: QueryBody,
    opts: QueryOptions = {},
  ): Promise<T[]> {
    const { autoPage = true, maxItems = Infinity } = opts;
    const key = entityKey(entity);
    const items: T[] = [];

    const first = await request<QueryResponse<T>>(
      "POST",
      `${entity}/query`,
      key,
      "read",
      body,
    );
    items.push(...first.items);

    // Folgeseiten: POST auf nextPageUrl MIT erneutem Body. Autotask verlangt den
    // Filter erneut (GET -> 405, fehlender Body -> 500). Der Paging-Token trägt nur
    // die Position, nicht den Filter – daher wird der Filter hier server-seitig
    // bei jeder Seite neu gesetzt.
    let next = first.pageDetails?.nextPageUrl ?? null;
    let pages = 1;
    while (autoPage && next && items.length < maxItems && pages < MAX_PAGES) {
      const page = await request<QueryResponse<T>>("POST", next, key, "read", body);
      items.push(...page.items);
      next = page.pageDetails?.nextPageUrl ?? null;
      pages++;
    }

    return maxItems === Infinity ? items : items.slice(0, maxItems);
  },

  // Eine einzelne Seite (für server-seitiges Next/Prev). `cursorUrl` ist eine von
  // Autotask gelieferte next/previous-URL; der Filter-`body` wird IMMER mitgesendet
  // (Position aus dem Cursor, Filter aus dem Body → Sichtbarkeit bleibt erzwungen).
  async queryPage<T>(
    entity: string,
    body: QueryBody,
    cursorUrl?: string,
  ): Promise<TicketPage<T>> {
    const key = entityKey(entity);
    let path = `${entity}/query`;
    if (cursorUrl) {
      // SSRF-Schutz: nur eigene Zone + genau dieser Entity-Paging-Pfad.
      const allowed = `${baseUrl()}/${entity}/query/`;
      if (!cursorUrl.startsWith(allowed)) {
        throw new Error("Ungültiger Paging-Cursor.");
      }
      path = cursorUrl;
    }
    const res = await request<QueryResponse<T>>("POST", path, key, "read", body);
    return {
      items: res.items,
      nextPageUrl: res.pageDetails?.nextPageUrl ?? null,
      prevPageUrl: res.pageDetails?.prevPageUrl ?? null,
    };
  },

  // Wie queryPage, aber mit OPAKEM Token statt voller Autotask-URL: Der Token ist
  // nur der Pfad NACH der Basis-URL (z. B. "Tickets/query/?...&token=..."). Die
  // Basis-URL bleibt server-seitig und gelangt nie zum Browser; beim Folgeaufruf wird
  // sie wieder davorgesetzt. Die SSRF-Prüfung aus queryPage greift weiter.
  async queryPageToken<T>(
    entity: string,
    body: QueryBody,
    token?: string,
  ): Promise<{ items: T[]; nextToken: string | null }> {
    const prefix = `${baseUrl()}/`;
    const cursorUrl = token ? `${prefix}${token}` : undefined;
    const page = await this.queryPage<T>(entity, body, cursorUrl);
    const next =
      page.nextPageUrl && page.nextPageUrl.startsWith(prefix)
        ? page.nextPageUrl.slice(prefix.length)
        : null;
    return { items: page.items, nextToken: next };
  },

  // POST {entity}/query/count -> Anzahl, ohne die Datensätze zu laden (effizient).
  async count(entity: string, filter: AutotaskFilter[]): Promise<number> {
    const res = await request<{ queryCount: number }>(
      "POST",
      `${entity}/query/count`,
      entityKey(entity),
      "read",
      { Filter: filter },
    );
    return res.queryCount ?? 0;
  },

  // GET {entity}/entityInformation/fields -> Felddefinitionen (inkl. Picklists).
  async fieldInfo(entity: string): Promise<FieldInfo[]> {
    const res = await request<{ fields: FieldInfo[] }>(
      "GET",
      `${entity}/entityInformation/fields`,
      entityKey(entity),
      "read",
    );
    return res.fields ?? [];
  },

  // GET {entity}/{id} -> einzelner Datensatz oder null.
  async get<T>(entity: string, id: number): Promise<T | null> {
    const key = entityKey(entity);
    const res = await request<{ item?: T; items?: T[] }>(
      "GET",
      `${entity}/${id}`,
      key,
      "read",
    );
    return res.item ?? res.items?.[0] ?? null;
  },

  // POST {path} -> itemId. `path` ist der Eltern-Pfad bei Child-Entitäten
  // (z. B. "Tickets/123/Notes"), NICHT die Top-Level-URL.
  async create(path: string, data: Record<string, unknown>): Promise<number> {
    const res = await request<{ itemId: number }>(
      "POST",
      path,
      entityKey(path),
      "write",
      data,
    );
    return res.itemId;
  },

  // PATCH {path} -> itemId. `data` muss die id enthalten.
  async update(path: string, data: Record<string, unknown>): Promise<number> {
    const res = await request<{ itemId: number }>(
      "PATCH",
      path,
      entityKey(path),
      "write",
      data,
    );
    return res.itemId;
  },

  // DELETE {path} -> entfernt einen (Child-)Datensatz. `path` ist der volle Pfad
  // inkl. ID (z. B. "Tickets/123/SecondaryResources/456"). Antwort wird ignoriert.
  async del(path: string): Promise<void> {
    await request<unknown>("DELETE", path, entityKey(path), "write");
  },
};

export type AutotaskClient = typeof autotask;
