"use client";

import * as React from "react";
import { Building2Icon, ContactIcon, HashIcon, TicketIcon } from "lucide-react";
import { toast } from "sonner";

import {
  ResultColumn,
  ResultGrid,
  type SearchResultItem,
} from "@/components/search/result-column";
import { openContactModal } from "@/lib/open-contact";

export type SearchKind = "firma" | "kontakt" | "ticket-name" | "ticket-nummer";

export interface InitialColumn {
  items: SearchResultItem[];
  nextToken: string | null;
  total: number | null;
}

type Initial = Record<SearchKind, InitialColumn>;
interface ColState extends InitialColumn {
  loadingMore: boolean;
}

const COLUMNS: { kind: SearchKind; title: string; icon: React.ReactNode }[] = [
  { kind: "firma", title: "Firma", icon: <Building2Icon className="size-3.5 shrink-0" /> },
  { kind: "kontakt", title: "Kontakte", icon: <ContactIcon className="size-3.5 shrink-0" /> },
  { kind: "ticket-name", title: "Ticket-Name", icon: <TicketIcon className="size-3.5 shrink-0" /> },
  { kind: "ticket-nummer", title: "Ticket-Nummer", icon: <HashIcon className="size-3.5 shrink-0" /> },
];

function seed(initial: Initial): Record<SearchKind, ColState> {
  return {
    firma: { ...initial.firma, loadingMore: false },
    kontakt: { ...initial.kontakt, loadingMore: false },
    "ticket-name": { ...initial["ticket-name"], loadingMore: false },
    "ticket-nummer": { ...initial["ticket-nummer"], loadingMore: false },
  };
}

// 4-Spalten-Ergebnisse mit „Mehr laden" je Spalte (Cursor-Token an /api/search).
// Erste Seite + Gesamtzahl kommen serverseitig (initial).
export function SearchColumns({
  query,
  initial,
}: {
  query: string;
  initial: Initial;
}) {
  const [cols, setCols] = React.useState<Record<SearchKind, ColState>>(() =>
    seed(initial),
  );

  // Neue Suche -> Spalten zurücksetzen (initial ist je Server-Render neu). Während
  // des Renders statt im Effect (React-Muster für „State aus vorherigem Render").
  const [prevInitial, setPrevInitial] = React.useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setCols(seed(initial));
  }

  async function loadMore(kind: SearchKind) {
    const col = cols[kind];
    if (!col.nextToken || col.loadingMore) return;
    setCols((c) => ({ ...c, [kind]: { ...c[kind], loadingMore: true } }));
    try {
      const url = `/api/search?kind=${kind}&q=${encodeURIComponent(
        query,
      )}&token=${encodeURIComponent(col.nextToken)}`;
      const res = await fetch(url, { cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as {
        items?: SearchResultItem[];
        nextToken?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(j.error ?? "Fehler beim Laden.");
      setCols((c) => ({
        ...c,
        [kind]: {
          items: [...c[kind].items, ...(j.items ?? [])],
          nextToken: j.nextToken ?? null,
          total: c[kind].total,
          loadingMore: false,
        },
      }));
    } catch (e) {
      setCols((c) => ({ ...c, [kind]: { ...c[kind], loadingMore: false } }));
      toast.error(e instanceof Error ? e.message : "Fehler beim Laden.");
    }
  }

  return (
    <ResultGrid>
      {COLUMNS.map((c) => {
        const s = cols[c.kind];
        return (
          <ResultColumn
            key={c.kind}
            title={c.title}
            icon={c.icon}
            items={s.items}
            total={s.total}
            hasMore={!!s.nextToken}
            loadingMore={s.loadingMore}
            onLoadMore={() => loadMore(c.kind)}
            // Kontakt = In-App-Overlay (gleiches Fenster); übrige Spalten navigieren.
            onSelect={
              c.kind === "kontakt"
                ? (href) => openContactModal(Number(href.split("/").pop()))
                : undefined
            }
            className="bg-card"
          />
        );
      })}
    </ResultGrid>
  );
}
