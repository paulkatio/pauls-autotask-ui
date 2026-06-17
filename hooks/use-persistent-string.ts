"use client";

import * as React from "react";

// Persistenter String-Zustand (localStorage) ohne Lade-Effect und ohne
// Hydration-Mismatch – nach dem Muster von use-column-order: localStorage ist ein
// externer Store, gelesen über useSyncExternalStore (Server-Snapshot = fallback,
// Client hydriert erst nach Mount aus dem In-Memory-Spiegel).
const mirror = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function emit(key: string) {
  listeners.get(key)?.forEach((l) => l());
}

function subscribe(key: string, onStoreChange: () => void) {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(onStoreChange);
  // Einmalig nach Mount hydrieren (erster Client-Render nutzt noch den Server-Snapshot).
  if (!mirror.has(key)) {
    const v = read(key);
    if (v != null) {
      mirror.set(key, v);
      onStoreChange();
    }
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key === key) {
      const v = read(key);
      if (v != null) mirror.set(key, v);
      else mirror.delete(key);
      emit(key);
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    set.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePersistentString(
  key: string,
  fallback: string,
): [string, (value: string) => void] {
  const sub = React.useCallback(
    (onStoreChange: () => void) => subscribe(key, onStoreChange),
    [key],
  );
  const value = React.useSyncExternalStore(
    sub,
    () => mirror.get(key) ?? fallback, // Client
    () => fallback, // Server
  );
  const setValue = React.useCallback(
    (v: string) => {
      mirror.set(key, v);
      try {
        localStorage.setItem(key, v);
      } catch {
        // localStorage nicht verfügbar -> nur In-Memory-Spiegel für die Sitzung.
      }
      emit(key);
    },
    [key],
  );
  return [value, setValue];
}
