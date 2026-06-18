"use client";

import * as React from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react/ssr";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Standard-Suchfeld der Listen/Tabellen: Lupe links, Eingabe, und – sobald Text
// vorhanden – ein Lösch-X rechts (ein Klick leert das Feld). Maße/Aussehen wie der
// bisherige Inline-Block (Lupe left-3 size-4, Input h-11 pl-9 sm:h-9); neu ist nur
// die Lösch-Geste. Reine shadcn-Bausteine + semantische Tokens, kein Custom-CSS.
export function SearchInput({
  value,
  onValueChange,
  className,
  containerClassName,
  clearLabel = "Eingabe löschen",
  ...props
}: {
  value: string;
  onValueChange: (value: string) => void;
  containerClassName?: string;
  clearLabel?: string;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) {
  return (
    <div className={cn("relative w-full", containerClassName)}>
      <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        // pr-9 nur bei Inhalt: Text rutscht nicht unter das X, wenn keins da ist.
        className={cn("h-11 pl-9 sm:h-9", value && "pr-9", className)}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onValueChange("")}
          aria-label={clearLabel}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none sm:right-1.5 sm:size-7"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
