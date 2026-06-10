"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

// Gemeinsame Ergebnis-Spalte für die globale Suche – genutzt in der Spotlight-
// Palette UND auf der /search-Seite, damit beide identisch aussehen und sich
// gleich responsiv verhalten.
export interface SearchResultItem {
  key: string;
  href: string;
  primary: string;
  secondary?: string | null;
}

const ROW_CLASS =
  "hover:bg-muted focus-visible:ring-ring flex w-full min-w-0 flex-col rounded-lg px-2 py-1.5 text-left outline-none focus-visible:ring-2";

function RowBody({ item }: { item: SearchResultItem }) {
  return (
    <>
      <span className="truncate text-sm">{item.primary}</span>
      {item.secondary ? (
        <span className="text-muted-foreground truncate text-xs tabular-nums">
          {item.secondary}
        </span>
      ) : null}
    </>
  );
}

export function ResultColumn({
  title,
  icon,
  items,
  loading,
  onSelect,
  className,
  total,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  title: string;
  // Fertig gerendertes Icon-Element (size-3.5) – KEINE Komponente, damit es auch
  // von Server-Komponenten (z. B. /search) übergeben werden kann.
  icon: React.ReactNode;
  items: SearchResultItem[];
  loading?: boolean;
  // In der Palette schließt onSelect den Dialog; auf der Seite navigiert ein <Link>.
  onSelect?: (href: string) => void;
  className?: string;
  // Optional (paginierte /search-Seite): Gesamtzahl + „Mehr laden".
  total?: number | null;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  return (
    <div className={cn("bg-background flex min-w-0 flex-col p-2", className)}>
      <div className="text-muted-foreground flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium">
        {icon}
        <span className="truncate">{title}</span>
        {items.length > 0 && (
          <span className="ml-auto tabular-nums">
            {total != null ? `${items.length} / ${total}` : items.length}
          </span>
        )}
      </div>
      {loading && items.length === 0 ? (
        <p className="text-muted-foreground px-2 py-1.5 text-sm">Suchen …</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground px-2 py-1.5 text-sm">Keine Treffer</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((it) => (
            <li key={it.key}>
              {onSelect ? (
                <button
                  type="button"
                  aria-label={it.primary}
                  onClick={() => onSelect(it.href)}
                  className={ROW_CLASS}
                >
                  <RowBody item={it} />
                </button>
              ) : (
                <Link href={it.href} className={ROW_CLASS}>
                  <RowBody item={it} />
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      {hasMore && onLoadMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring mt-1 rounded-lg px-2 py-1.5 text-sm font-medium outline-none focus-visible:ring-2 disabled:opacity-50"
        >
          {loadingMore ? "Lädt …" : "Mehr laden"}
        </button>
      )}
    </div>
  );
}

// Responsives 4-Spalten-Raster (1 → 2 ab sm → 4 ab xl). Spalten durch 1px-Lücken
// auf Border-Farbe getrennt. `dense` (Palette) begrenzt die Höhe + scrollt.
export function ResultGrid({
  children,
  dense,
  className,
}: {
  children: React.ReactNode;
  dense?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-border grid grid-cols-1 gap-px sm:grid-cols-2 xl:grid-cols-4",
        dense
          ? "max-h-[60dvh] overflow-y-auto sm:max-h-96"
          : "overflow-hidden rounded-lg border",
        className,
      )}
    >
      {children}
    </div>
  );
}
