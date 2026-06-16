"use client";

import * as React from "react";

// Wiederverwendbare Klick-zum-Sortieren-Logik für die Tabellenansichten (Desktop).
// Eine Spalte ist sortierbar, sobald sie einen `sortValue`-Getter mitbringt; der
// liefert je Zeile einen vergleichbaren Wert (Text -> alphabetisch de, Zahl/Datum
// -> numerisch). Klick-Zyklus pro Spalte: aufsteigend -> absteigend -> aus.
// Leere Werte (null/undefined/"") landen unabhängig von der Richtung immer hinten.

export type SortDir = "asc" | "desc";
export interface SortState {
  key: string;
  dir: SortDir;
}

export type SortValue = string | number | null | undefined;

export interface SortableColumn {
  key: string;
  sortValue?: (row: never) => SortValue;
}

function isEmpty(v: SortValue): boolean {
  return v == null || v === "";
}

function baseCompare(a: Exclude<SortValue, null | undefined>, b: typeof a): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "de", { numeric: true });
}

export function useTableSort<T>(
  columns: { key: string; sortValue?: (row: T) => SortValue }[],
) {
  const [sort, setSort] = React.useState<SortState | null>(null);

  const getters = React.useMemo(() => {
    const map = new Map<string, (row: T) => SortValue>();
    for (const c of columns) if (c.sortValue) map.set(c.key, c.sortValue);
    return map;
  }, [columns]);

  const isSortable = React.useCallback((key: string) => getters.has(key), [getters]);

  const toggle = React.useCallback(
    (key: string) => {
      if (!getters.has(key)) return;
      setSort((prev) =>
        prev && prev.key === key
          ? prev.dir === "asc"
            ? { key, dir: "desc" }
            : null // asc -> desc -> aus
          : { key, dir: "asc" },
      );
    },
    [getters],
  );

  const sortRows = React.useCallback(
    (rows: T[]): T[] => {
      if (!sort) return rows;
      const get = getters.get(sort.key);
      if (!get) return rows;
      const factor = sort.dir === "asc" ? 1 : -1;
      return [...rows].sort((a, b) => {
        const av = get(a);
        const bv = get(b);
        const ae = isEmpty(av);
        const be = isEmpty(bv);
        if (ae && be) return 0;
        if (ae) return 1; // leere Werte immer hinten
        if (be) return -1;
        return factor * baseCompare(av as never, bv as never);
      });
    },
    [sort, getters],
  );

  // Für aria-sort am <th>.
  const ariaSort = React.useCallback(
    (key: string): "ascending" | "descending" | "none" =>
      sort?.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none",
    [sort],
  );

  return { sort, toggle, sortRows, isSortable, ariaSort };
}
