// Exponentielles Backoff für 429-Antworten. Autotask sendet KEINE Rate-Limit-Header
// (DECISIONS V6) → wir drosseln/retry'en blind. Reine Logik, isoliert testbar.

export class RetryableError extends Error {
  constructor(public readonly status: number) {
    super(`Retryable HTTP ${status}`);
    this.name = "RetryableError";
  }
}

export function backoffDelay(attempt: number, baseMs: number): number {
  return baseMs * 2 ** attempt; // 500, 1000, 2000, 4000, ...
}

export interface RetryOptions {
  retries?: number;
  baseMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const { retries = 4, baseMs = 500, sleep = defaultSleep } = opts;
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof RetryableError && attempt < retries) {
        await sleep(backoffDelay(attempt, baseMs));
        attempt++;
        continue;
      }
      throw err;
    }
  }
}
