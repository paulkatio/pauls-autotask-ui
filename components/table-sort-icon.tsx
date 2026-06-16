"use client";

import { ChevronDownIcon, ChevronUpIcon, ChevronsUpDownIcon } from "lucide-react";

// Sortier-Indikator für klickbare Tabellenköpfe – einheitlich über alle
// Tabellenansichten. Aktiv: Pfeil auf/ab. Sortierbar aber inaktiv: dezenter
// Doppelpfeil, der erst beim Hover über den Kopf erscheint (Gruppe `sorthead`).
export function SortIcon({
  state,
}: {
  state: "asc" | "desc" | "none";
}) {
  if (state === "asc") return <ChevronUpIcon className="size-3.5 shrink-0" />;
  if (state === "desc") return <ChevronDownIcon className="size-3.5 shrink-0" />;
  return (
    <ChevronsUpDownIcon className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover/sorthead:opacity-50" />
  );
}
