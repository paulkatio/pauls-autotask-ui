"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MagnifyingGlass, X } from "@phosphor-icons/react/ssr";

import { Input } from "@/components/ui/input";
import { navProgress } from "@/lib/nav-progress";

// Große Suchleiste der /search-Seite (Spotlight-Stil). Enter sucht; es wird
// gleichzeitig in allen vier Spalten gesucht (siehe Seite).
export function SearchBox() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = React.useState(searchParams.get("q") ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = q.trim();
    navProgress.start();
    router.push(t ? `/search?q=${encodeURIComponent(t)}` : "/search");
  }

  return (
    <form onSubmit={submit} className="relative w-full max-w-2xl">
      <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Suchen … Tickets, Firmen, Kontakte"
        aria-label="Suche"
        className={q ? "h-12 pl-11 pr-12 text-base" : "h-12 pl-11 text-base"}
      />
      {q && (
        <button
          type="button"
          onClick={() => setQ("")}
          aria-label="Eingabe löschen"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-3 flex size-8 -translate-y-1/2 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <X className="size-5" />
        </button>
      )}
    </form>
  );
}
