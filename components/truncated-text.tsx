"use client";

import * as React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Einzeiliger, abgeschnittener Text. Beim Hover (sofort, Provider-Delay 0 im
// Layout) erscheint der volle Text als Tooltip – ABER nur, wenn er tatsächlich
// abgeschnitten ist (gemessen via ResizeObserver). Sonst kein Tooltip.
export function TruncatedText({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = React.useState(false);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setTruncated(el.scrollWidth > el.clientWidth + 1);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span ref={ref} className={cn("block truncate", className)} />
        }
      >
        {children}
      </TooltipTrigger>
      {truncated && (
        <TooltipContent className="max-w-sm">{children}</TooltipContent>
      )}
    </Tooltip>
  );
}
