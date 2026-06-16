import "server-only";

import { AutotaskError } from "@/lib/autotask/client";

// Lädt Server-Daten und kapselt den try/catch um den DATEN-Zugriff (nicht um JSX).
// So bleibt die maßgeschneiderte Fehler-UI je Seite server-seitig erhalten (inkl.
// 429-Unterscheidung) – im Gegensatz zu reinen error.tsx-Boundaries, deren
// Fehlertext Next in Produktion zum Client hin redigiert. Die Seite verzweigt auf
// das Ergebnis und konstruiert JSX NUR außerhalb von try/catch
// (react-hooks/error-boundaries zufrieden).
export type LoadResult<T> =
  | { ok: true; data: T }
  | { ok: false; rateLimited: boolean };

export async function loadOrError<T>(
  fn: () => Promise<T>,
): Promise<LoadResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return {
      ok: false,
      rateLimited: e instanceof AutotaskError && e.status === 429,
    };
  }
}
