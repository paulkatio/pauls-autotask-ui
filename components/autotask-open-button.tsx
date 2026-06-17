import { ExternalLinkIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { AutotaskLogo } from "@/components/icons/autotask-logo";
import { cn } from "@/lib/utils";

// „In Autotask öffnen"-Knopf. Öffnet die echte Autotask-Weboberfläche in neuem Tab.
// - href fehlt (null) -> rendert nichts (Failsafe aus lib/autotask/links.ts).
// - label gesetzt -> Voll-Button mit Text (Desktop).
// - label weg -> Icon-only (Mobile); braucht zwingend aria-label.
export function AutotaskOpenButton({
  href,
  label,
  className,
}: {
  href: string | null;
  label?: string;
  className?: string;
}) {
  if (!href) return null;

  const iconOnly = !label;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={iconOnly ? "In Autotask öffnen" : undefined}
      title="In Autotask öffnen"
      className={cn(
        buttonVariants({ variant: "outline", size: iconOnly ? "icon" : "sm" }),
        iconOnly && "size-11 sm:size-9",
        // Voll-Button (mit Label) einheitlich h-11 (Mobile) / h-9 (Desktop) wie die
        // benachbarten Aktionen („Neues Ticket", Suche, Filter).
        !iconOnly && "h-11 sm:h-9",
        className,
      )}
    >
      <AutotaskLogo className="size-4" />
      {label}
      {!iconOnly && <ExternalLinkIcon />}
    </a>
  );
}
