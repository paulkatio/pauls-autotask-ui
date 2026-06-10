import * as React from "react";

import { cn } from "@/lib/utils";

// Einheitlicher Seitenkopf: klarer Seitentitel (h1) + optionaler Untertitel und
// rechtsbündige Aktionen. Rein präsentational (Typografie/Layout über Tailwind-
// Utilities, keine eigenen Farben). Sorgt für konsistente Hierarchie auf allen
// Seiten (typeset).
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // Aktion (z. B. „Neues Ticket") sitzt auch mobil rechts neben dem Titel,
        // statt als Block zwischen Titel und Suche zu stehen.
        "flex flex-row items-start justify-between gap-2 sm:gap-4",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground text-sm text-pretty">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
