"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { CountDatum } from "@/lib/autotask/entities/dashboard";

const chartConfig = {
  count: { label: "Offene Tickets", color: "var(--chart-1)" },
} satisfies ChartConfig;

// Auf schmalen Viewports kompakt als „Vorname N." (Vorname + Initial des Nachnamens)
// – kurz genug für die schrägen Labels, aber eindeutiger als nur der Vorname.
// Voller Name bleibt im Tooltip.
function shortName(value: string): string {
  const parts = value.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? value;
  const lastInitial = parts[parts.length - 1][0];
  return `${parts[0]} ${lastInitial}.`;
}

export function CountBarChart({
  title,
  data,
}: {
  title: string;
  data: CountDatum[];
}) {
  const router = useRouter();

  // Responsive ohne Overengineering: bis einschl. mittelgroßer Viewports die Labels
  // schräg stellen + nur Vorname (kein Überlappen, kein Abschneiden); erst auf
  // breiten Bildschirmen (>= xl) horizontal mit vollem Namen.
  const [compact, setCompact] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 1279px)");
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Klick auf einen Balken -> Tickets dieses Mitarbeiters (nur wenn id vorhanden).
  // Recharts liefert das Datum unter `payload`.
  function handleBarClick(entry: { payload?: CountDatum }) {
    const id = entry?.payload?.id;
    if (id != null) router.push(`/tickets/team?resource=${id}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Offene Tickets je zugewiesenem Mitarbeiter – Balken zum Filtern klicken.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
          <BarChart accessibilityLayer data={data} margin={{ top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={0}
              angle={compact ? -30 : 0}
              textAnchor={compact ? "end" : "middle"}
              height={compact ? 52 : 28}
              tickFormatter={compact ? shortName : undefined}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideIndicator
                  formatter={(value) => (
                    <span className="text-foreground">{value} offene Tickets</span>
                  )}
                />
              }
            />
            <Bar
              dataKey="count"
              fill="var(--color-count)"
              radius={4}
              onClick={(d) => handleBarClick(d as { payload?: CountDatum })}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
