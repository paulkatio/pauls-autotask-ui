import { Badge } from "@/components/ui/badge";
import { priorityVariant } from "@/lib/autotask/mappers";
import { cn } from "@/lib/utils";

// Prioritäts-Badge. „Hoch" (1) = SANFTES Rot (Outline-Rot ohne Füllung), klar
// abgesetzt von „Kritisch" (4) = gefülltes destructive-Rot (lauter). So sind die
// beiden Rotstufen unterscheidbar; „Hoch" ist nicht mehr schlicht Schwarz.
// Mittel/Niedrig/unbekannt nutzen die Standard-Varianten (mappers.priorityVariant).
export function PriorityBadge({
  priority,
  label,
  className,
}: {
  priority: number | null | undefined;
  label: string;
  className?: string;
}) {
  if (priority === 1) {
    return (
      <Badge
        variant="outline"
        className={cn("border-destructive/40 text-destructive", className)}
      >
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant={priorityVariant(priority)} className={className}>
      {label}
    </Badge>
  );
}
