import "server-only";

import { createLimiter } from "@/lib/autotask/limiter";
import { withRetry, RetryableError } from "@/lib/autotask/backoff";
import { recordApiCall } from "@/lib/autotask/rate-monitor";

// Zentrale, server-only Brücke zur Autotask REST API (BFF, CLAUDE.md §5).
// Generischer Kern: query / get / create / update. Entitätsspezifische Wrapper
// liegen in lib/autotask/entities/* (Erweiterbarkeitsprinzip, DECISIONS.md).
//
// Sicherheit: Base-URL/UserName/Secret/IntegrationCode kommen aus process.env und
// werden NIEMALS geloggt oder in Antworten/Fehlern an den Browser zurückgegeben.
// "server-only" verhindert, dass dieses Modul je ins Client-Bundle gelangt.

const MAX_CONCURRENCY_PER_ENTITY = 2; // Autotask: max 3/Tabelle; defensiv 2.
const MAX_PAGES = 50; // harte Obergrenze beim Auto-Paging.

const limiter = createLimiter(MAX_CONCURRENCY_PER_ENTITY);

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
}

function baseUrl(): string {
  const base = process.env.AUTOTASK_BASE_URL;
  if (!base) throw new Error("AUTOTASK_BASE_URL fehlt in der Umgebung.");
  return base.replace(/\/$/, "");
}

function authHeaders(): Record<string, string> {
  const { AUTOTASK_INTEGRATION_CODE, AUTOTASK_API_USERNAME, AUTOTASK_API_SECRET } =
    process.env;
  if (!AUTOTASK_INTEGRATION_CODE || !AUTOTASK_API_USERNAME || !AUTOTASK_API_SECRET) {
    throw new Error("Autotask-Zugangsdaten fehlen in der Umgebung.");
  }
  return {
    ApiIntegrationCode: AUTOTASK_INTEGRATION_CODE,
    UserName: AUTOTASK_API_USERNAME,
    Secret: AUTOTASK_API_SECRET,
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

// Ein einzelner HTTP-Aufruf: gedrosselt (Limiter pro Entität) + 429-Backoff.
async function request<T = unknown>(
  method: string,
  pathOrUrl: string,
  key: string,
  body?: unknown,
): Promise<T> {
  return limiter(key, () =>
    withRetry(async () => {
      // Jeder echte HTTP-Versuch (inkl. Retries) zählt aufs 10k/h-Tenant-Limit.
      recordApiCall();
      const res = await fetch(resolveUrl(pathOrUrl), {
        method,
        headers: authHeaders(),
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });

      if (res.status === 429) {
        throw new RetryableError(429); // blind drosseln (keine Header von Autotask)
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
    }),
  );
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
      const page = await request<QueryResponse<T>>("POST", next, key, body);
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
    const res = await request<QueryResponse<T>>("POST", path, key, body);
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
      data,
    );
    return res.itemId;
  },

  // DELETE {path} -> entfernt einen (Child-)Datensatz. `path` ist der volle Pfad
  // inkl. ID (z. B. "Tickets/123/SecondaryResources/456"). Antwort wird ignoriert.
  async del(path: string): Promise<void> {
    await request<unknown>("DELETE", path, entityKey(path));
  },
};

export type AutotaskClient = typeof autotask;
