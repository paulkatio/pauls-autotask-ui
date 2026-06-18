"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { TimeRange } from "@/lib/autotask/entities/my-time";

// Umschalter Heute / Diese Woche – steuert den ?range=-Parameter (server liest ihn).
export function RangeToggle({ range }: { range: TimeRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function set(next: TimeRange) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", next);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border p-0.5">
      <Button
        variant={range === "today" ? "default" : "ghost"}
        size="sm"
        className="h-11 sm:h-9"
        onClick={() => set("today")}
      >
        Heute
      </Button>
      <Button
        variant={range === "week" ? "default" : "ghost"}
        size="sm"
        className="h-11 sm:h-9"
        onClick={() => set("week")}
      >
        Diese Woche
      </Button>
    </div>
  );
}
