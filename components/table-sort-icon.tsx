"use client";

import { CaretDown, CaretUp, CaretUpDown } from "@phosphor-icons/react/ssr";

// Sortier-Indikator für klickbare Tabellenköpfe – einheitlich über alle
// Tabellenansichten. Aktiv: Pfeil auf/ab. Sortierbar aber inaktiv: dezenter
// Doppelpfeil, der erst beim Hover über den Kopf erscheint (Gruppe `sorthead`).
export function SortIcon({
  state,
}: {
  state: "asc" | "desc" | "none";
}) {
  if (state === "asc") return <CaretUp className="size-3.5 shrink-0" />;
  if (state === "desc") return <CaretDown className="size-3.5 shrink-0" />;
  return (
    <CaretUpDown className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover/sorthead:opacity-50" />
  );
}
