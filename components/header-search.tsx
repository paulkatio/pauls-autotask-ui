"use client";

import * as React from "react";
import { SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { OPEN_COMMAND_PALETTE } from "@/components/command-palette";

// Header-Suche = Auslöser der Command-Palette (Cmd/Ctrl+K). Desktop: ein
// suchfeld-artiger Button mit Tastenkürzel-Hinweis; Mobile: ein Such-Icon.
// Beide öffnen dieselbe Palette (Navigation + Ticketsuche) per Custom-Event.
function openPalette() {
  window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE));
}

export function HeaderSearch() {
  // Plattformabhängiges Kürzel (⌘K auf macOS, sonst Strg K) – clientseitig ermittelt.
  const [isMac, setIsMac] = React.useState(false);
  React.useEffect(() => {
    setIsMac(/mac/i.test(navigator.platform));
  }, []);

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
          <SearchIcon className="size-4" />
          Suche …
        </span>
        <kbd className="bg-muted text-muted-foreground pointer-events-none flex h-5 items-center gap-0.5 rounded border px-1.5 text-xs font-medium tabular-nums">
          {isMac ? "⌘" : "Strg"} + K
        </kbd>
      </Button>

      {/* Mobile: Such-Icon */}
      <Button
        variant="ghost"
        size="icon"
        onClick={openPalette}
        className="md:hidden"
        aria-label="Suche öffnen"
      >
        <SearchIcon />
      </Button>
    </>
  );
}
