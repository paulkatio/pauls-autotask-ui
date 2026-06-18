"use client";

import * as React from "react";
import { MagnifyingGlass } from "@phosphor-icons/react/ssr";

import { Button } from "@/components/ui/button";
import { OPEN_COMMAND_PALETTE } from "@/components/command-palette";

// Header-Suche = Auslöser der Command-Palette (Cmd/Ctrl+K). Desktop: ein
// suchfeld-artiger Button mit Tastenkürzel-Hinweis; Mobile: ein Such-Icon.
// Beide öffnen dieselbe Palette (Navigation + Ticketsuche) per Custom-Event.
function openPalette() {
  window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE));
}

export function HeaderSearch() {
  // Plattformabhängiges Kürzel (⌘K auf macOS, sonst Strg K) – clientseitig, SSR-sicher
  // ohne setState-im-Effect: useSyncExternalStore (Server-Snapshot = false).
  const isMac = React.useSyncExternalStore(
    () => () => {}, // kein Abo nötig (Wert ändert sich zur Laufzeit nicht)
    () => /mac/i.test(navigator.platform),
    () => false,
  );

  return (
    <>
      {/* Desktop: suchfeld-artiger Button */}
      <Button
        variant="outline"
        onClick={openPalette}
        aria-label="Suche öffnen (Tastenkürzel)"
        className="text-muted-foreground hidden w-56 justify-between font-normal md:flex lg:w-72"
      >
        <span className="flex items-center gap-2">
          <MagnifyingGlass className="size-4" />
          Suche …
        </span>
        <kbd className="bg-muted text-muted-foreground pointer-events-none flex h-5 items-center gap-0.5 rounded border px-1.5 text-xs font-medium tabular-nums">
          {isMac ? "⌘" : "Strg"} + K
        </kbd>
      </Button>
      {/* Mobil kein Such-Icon im Header mehr – die Suche sitzt unten in der
          Bottom-Navigation (Tab „Suche"). */}
    </>
  );
}
