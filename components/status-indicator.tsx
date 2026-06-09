import { Badge } from "@/components/ui/badge";
import { statusColor, statusVariant } from "@/lib/autotask/mappers";
import { cn } from "@/lib/utils";

// Kleiner farbiger Punkt vor dem Status – wie in Autotask. Farbe aus statusColor().
// Inline-Style, weil die Farbe pro Status aus einer Map kommt (keine Tailwind-Token).
export function StatusDot({
  status,
  className,
}: {
  status: number | null | undefined;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: statusColor(status) }}
    />
  );
}

// Status-Badge mit vorangestelltem Farbpunkt – für Listen/Tabellen.
export function StatusBadge({
  status,
  label,
}: {
  status: number | null | undefined;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <StatusDot status={status} />
      <Badge variant={statusVariant(status)}>{label}</Badge>
    </span>
  );
}
