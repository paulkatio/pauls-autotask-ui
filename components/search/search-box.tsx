"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";

// Große Suchleiste der /search-Seite (Spotlight-Stil). Enter sucht; es wird
// gleichzeitig in allen vier Spalten gesucht (siehe Seite).
export function SearchBox() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = React.useState(searchParams.get("q") ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = q.trim();
    router.push(t ? `/search?q=${encodeURIComponent(t)}` : "/search");
  }

  return (
    <form onSubmit={submit} className="relative w-full max-w-2xl">
      <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Suchen … Tickets, Firmen, Kontakte"
        aria-label="Suche"
        className="h-12 pl-11 text-base"
      />
    </form>
  );
}
