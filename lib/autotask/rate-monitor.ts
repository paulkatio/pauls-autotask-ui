// Leichter Frühwarn-Zähler für das Autotask-Stundenlimit (10.000 Calls/h je Tenant,
// unabhängig vom Thread-Limit — siehe „API thread limiting"). KEIN harter Riegel:
// zählt nur die HTTP-Calls dieser Prozessinstanz im laufenden 1-Stunden-Fenster und
// loggt eine Warnung, sobald die Schwelle erreicht ist. Reine Logik, server-seitig.
//
// Grenzen bewusst klar: Der Zähler ist PRO PROZESS (wie der Limiter). Bei mehreren
// Instanzen unterzählt er global — er ist eine Betriebs-Warnung, keine Abrechnung.

const HOUR_MS = 3_600_000;
const HOURLY_LIMIT = 10_000;
const WARN_AT = 8_000; // 80 % → früh genug, um zu reagieren

export interface RateMonitorState {
  windowStart: number;
  count: number;
  warned: boolean;
}

// Reine Übergangsfunktion (für Tests ohne Uhr/Logger): nimmt den alten Zustand +
// „jetzt" und gibt den neuen Zustand zurück, plus ob JETZT gewarnt werden soll.
export function tick(
  state: RateMonitorState,
  now: number,
): { state: RateMonitorState; warn: boolean } {
  // Fenster abgelaufen → zurücksetzen.
  if (now - state.windowStart >= HOUR_MS) {
    return { state: { windowStart: now, count: 1, warned: false }, warn: false };
  }
  const count = state.count + 1;
  const shouldWarn = count >= WARN_AT && !state.warned;
  return {
    state: { ...state, count, warned: state.warned || shouldWarn },
    warn: shouldWarn,
  };
}

// Prozessweiter Zustand + Verdrahtung mit Uhr und Logger.
let current: RateMonitorState = { windowStart: 0, count: 0, warned: false };

export function recordApiCall(now: number = Date.now()): void {
  if (current.windowStart === 0) current = { windowStart: now, count: 0, warned: false };
  const { state, warn } = tick(current, now);
  current = state;
  if (warn) {
    console.warn(
      `[autotask] ${state.count} API-Calls in der laufenden Stunde (Tenant-Limit ${HOURLY_LIMIT}/h). ` +
        `Volumen prüfen – Schwelle ${WARN_AT} erreicht. (Zähler pro Instanz, global ggf. höher.)`,
    );
  }
}

export const RATE_LIMITS = { HOURLY_LIMIT, WARN_AT, HOUR_MS } as const;
