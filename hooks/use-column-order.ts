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

export function useColumnOrder(
  storageKey: string,
  columnIds: string[],
): ColumnOrder {
  const idsKey = columnIds.join("|");
  const [order, setOrder] = React.useState<string[]>(columnIds);
  const [customized, setCustomized] = React.useState(false);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);

  // Reihenfolge laden + mit aktuellen Spalten versöhnen (kein Hydration-Mismatch:
  // localStorage erst im Effect). Läuft neu, wenn sich die Spaltenmenge ändert.
  React.useEffect(() => {
    let saved: unknown = null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) saved = JSON.parse(raw);
    } catch {
      saved = null;
    }
    const valid = Array.isArray(saved)
      ? (saved as unknown[]).filter(
          (id): id is string => typeof id === "string" && columnIds.includes(id),
        )
      : [];
    const missing = columnIds.filter((id) => !valid.includes(id));
    setOrder([...valid, ...missing]);
    setCustomized(valid.length > 0);
  }, [storageKey, idsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = React.useCallback(
    (next: string[]) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // localStorage nicht verfügbar -> Reihenfolge bleibt nur für diese Sitzung.
      }
    },
    [storageKey],
  );

  const move = React.useCallback(
    (fromId: string, toId: string) => {
      setOrder((prev) => {
        if (fromId === toId) return prev;
        const next = prev.filter((id) => id !== fromId);
        const idx = next.indexOf(toId);
        if (idx < 0) return prev;
        next.splice(idx, 0, fromId);
        persist(next);
        return next;
      });
      setCustomized(true);
    },
    [persist],
  );

  const reset = React.useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignorieren
    }
    setOrder(columnIds);
    setCustomized(false);
  }, [storageKey, idsKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
