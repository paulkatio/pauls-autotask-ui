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
        "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
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
