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

  // Auf dem Smartphone funktioniert das Balkendiagramm schlecht (zu viele Namen auf
  // wenig Breite) → unter sm stattdessen eine kompakte, sortierte Liste mit Mini-
  // Auslastungsbalken. Gleiche Klick-Aktion (Filter auf den Mitarbeiter).
  const [small, setSmall] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setSmall(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const maxCount = Math.max(1, ...data.map((d) => d.count));

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
        {small ? (
          data.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Keine offenen Tickets.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {data.map((d) => (
                <li key={d.id ?? d.label}>
                  <button
                    type="button"
                    disabled={d.id == null}
                    onClick={() =>
                      d.id != null &&
                      router.push(`/tickets/team?resource=${d.id}`)
                    }
                    className="hover:bg-muted flex w-full flex-col gap-1.5 rounded-md px-3 py-2 text-left transition-colors disabled:pointer-events-none"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm">{d.label}</span>
                      <span className="text-sm font-semibold tabular-nums">
                        {d.count}
                      </span>
                    </div>
                    <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full bg-[var(--chart-1)]"
                        style={{ width: `${(d.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
}
