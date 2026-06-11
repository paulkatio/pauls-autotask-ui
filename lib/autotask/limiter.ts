// Concurrency-Limiter pro Schlüssel (= Autotask-Entität). Autotask erlaubt nur
// wenige parallele Requests pro Tabelle; wir drosseln defensiv (Default 2).
// Reine Logik, kein server-only – dadurch isoliert testbar.

export function createLimiter(
  max: number,
  // Optionale schärfere Obergrenze je Schlüssel (z. B. die heiße Tickets-Tabelle auf
  // 1, damit diese Prozessinstanz nur EINEN Ticket-Thread belegt). Wichtig auf
  // Vercel: der Limiter koordiniert NICHT über Instanzen — bei niedriger
  // Per-Instanz-Concurrency bleibt die Summe mehrerer Instanzen eher unter dem 3er-Limit.
  perKey: Record<string, number> = {},
) {
  const active = new Map<string, number>();
  const waiters = new Map<string, Array<() => void>>();

  const limitFor = (key: string): number => perKey[key] ?? max;

  function acquire(key: string): Promise<void> {
    const n = active.get(key) ?? 0;
    if (n < limitFor(key)) {
      active.set(key, n + 1);
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const q = waiters.get(key) ?? [];
      q.push(resolve);
      waiters.set(key, q);
    });
  }

  function release(key: string): void {
    const q = waiters.get(key);
    if (q && q.length > 0) {
      // Slot direkt an den nächsten Wartenden übergeben (active bleibt gleich).
      q.shift()!();
    } else {
      active.set(key, Math.max(0, (active.get(key) ?? 1) - 1));
    }
  }

  return async function run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    await acquire(key);
    try {
      return await fn();
    } finally {
      release(key);
    }
  };
}

export type Limiter = ReturnType<typeof createLimiter>;
