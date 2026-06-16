"use client";

import * as React from "react";

// Wiederverwendbare Spaltenreihenfolge per Drag & Drop, persistiert in localStorage.
// Bewusst ohne Fremd-Library (native HTML5-DnD). `storageKey` ist pro Tabelle
// eindeutig; `columnIds` ist die Standardreihenfolge. Neue/entfernte Spalten werden
// beim Laden mit der gespeicherten Reihenfolge versöhnt (neue hinten angehängt).
export interface ColumnOrder {
  order: string[];
  isDragging: boolean;
  headProps: (id: string) => React.HTMLAttributes<HTMLElement> & {
    draggable: boolean;
  };
  reset: () => void;
  customized: boolean;
}

// --- localStorage als externer Store -----------------------------------------
// In-Memory-Spiegel je storageKey: stabile Snapshot-Quelle für useSyncExternalStore
// (gleiche Array-Referenz bis zur nächsten Änderung -> kein Endlos-Render) und
// Sitzungs-Fallback, falls localStorage nicht verfügbar ist. localStorage ist reine
// Persistenz. So entfällt der frühere Lade-Effect (kein setState im Effect-Body).
const mirror = new Map<string, string[] | null>();
const listeners = new Map<string, Set<() => void>>();

function readLS(key: string): string[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : null;
  } catch {
    return null;
  }
}

function writeLS(key: string, next: string[] | null) {
  try {
    if (next) localStorage.setItem(key, JSON.stringify(next));
    else localStorage.removeItem(key);
  } catch {
    // localStorage nicht verfügbar -> nur In-Memory-Spiegel; Reihenfolge bleibt
    // dann für diese Sitzung erhalten.
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
  // Einmalig nach Mount aus localStorage hydrieren (kein Hydration-Mismatch:
  // der erste Client-Render nutzt noch den Server-Snapshot = null).
  if (!mirror.has(key)) {
    mirror.set(key, readLS(key));
    onStoreChange();
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key === key) {
      mirror.set(key, readLS(key));
      emit(key);
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    set.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function setOrderFor(key: string, next: string[] | null) {
  mirror.set(key, next);
  writeLS(key, next);
  emit(key);
}

// Gespeicherte Reihenfolge mit aktuellen Spalten versöhnen: nur noch existierende
// Spalten behalten, neue hinten anhängen. `customized` = es lag eine gültige
// gespeicherte Reihenfolge vor.
function reconcile(saved: string[] | null, columnIds: string[]) {
  const valid = (saved ?? []).filter((id) => columnIds.includes(id));
  const missing = columnIds.filter((id) => !valid.includes(id));
  return { order: [...valid, ...missing], customized: valid.length > 0 };
}

export function useColumnOrder(
  storageKey: string,
  columnIds: string[],
): ColumnOrder {
  const idsKey = columnIds.join("|");
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);

  const sub = React.useCallback(
    (onStoreChange: () => void) => subscribe(storageKey, onStoreChange),
    [storageKey],
  );
  const saved = React.useSyncExternalStore(
    sub,
    () => mirror.get(storageKey) ?? null, // Client
    () => null, // Server: keine gespeicherte Reihenfolge
  );

  // idsKey (statt columnIds) als stabile Abhängigkeit: das columnIds-Array wechselt
  // pro Render die Identität, der join-String nicht. Spalten daraus rekonstruieren,
  // damit exhaustive-deps ohne Ausnahme erfüllt ist.
  const { order, customized } = React.useMemo(() => {
    const cols = idsKey ? idsKey.split("|") : [];
    return reconcile(saved, cols);
  }, [saved, idsKey]);

  const move = React.useCallback(
    (fromId: string, toId: string) => {
      if (fromId === toId) return;
      const cols = idsKey ? idsKey.split("|") : [];
      const current = reconcile(mirror.get(storageKey) ?? null, cols).order;
      const next = current.filter((id) => id !== fromId);
      const idx = next.indexOf(toId);
      if (idx < 0) return;
      next.splice(idx, 0, fromId);
      setOrderFor(storageKey, next);
    },
    [storageKey, idsKey],
  );

  const reset = React.useCallback(() => {
    setOrderFor(storageKey, null);
  }, [storageKey]);

  const headProps = React.useCallback(
    (id: string) => ({
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        setDragId(id);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id);
      },
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setOverId((o) => (o === id ? o : id));
      },
      onDragLeave: () => {
        setOverId((o) => (o === id ? null : o));
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const from = dragId ?? e.dataTransfer.getData("text/plain");
        if (from) move(from, id);
        setDragId(null);
        setOverId(null);
      },
      onDragEnd: () => {
        setDragId(null);
        setOverId(null);
      },
      "data-dragging": dragId === id ? "" : undefined,
      "data-dragover": overId === id && dragId !== id ? "" : undefined,
    }),
    [dragId, overId, move],
  );

  return { order, isDragging: dragId !== null, headProps, reset, customized };
}
