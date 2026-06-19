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

// Tooltip-Inhalt mit weicher Animation: beim Hover/Balkenwechsel faded + zoomt der
// Inhalt sanft ein (key=Label -> Remount = erneutes animate-in). Die Position bleibt
// instant am Cursor (kein „Einflug von links"). Recharts injiziert die Props.
function AnimatedTooltipContent(
  props: React.ComponentProps<typeof ChartTooltipContent>,
) {
  const label = (props as { label?: React.ReactNode }).label;
  return (
    <div
      key={String(label ?? "")}
      className="animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-1 duration-200 ease-out"
    >
      <ChartTooltipContent
        {...props}
        hideIndicator
        formatter={(value) => (
          <span className="text-foreground">{value} offene Tickets</span>
        )}
      />
    </div>
  );
}

export function CountBarChart({
  title,
  data,
}: {
  title: string;
  data: CountDatum[];
}) {
  const router = useRouter();

  // Labels IMMER schräg + gekürzt („Vorname N."). Der Chart sitzt auf der Übersicht
  // in einer 3/4-Spalte – bei 9 Namen überlappen horizontale Labels sonst auch auf
  // breiten Viewports (Container schmal, Viewport breit). Schräg + kurz ist auf jeder
  // Breite kollisionsfrei; der volle Name bleibt im Tooltip.
  const compact = true;

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

  // Schräge X-Achsen-Labels brauchen je nach Namenslänge unterschiedlich viel
  // vertikalen Platz – sonst werden lange Namen unten abgeschnitten. Wir messen die
  // (im Compact-Modus gekürzten) Labels und leiten die Achsenhöhe geometrisch ab:
  // bei Winkel θ ragt ein Label sin(θ)·Textbreite nach unten. Plot-Höhe bleibt
  // konstant, nur die Gesamthöhe wächst → die Balken springen nicht.
  const ANGLE_DEG = 35; // etwas steiler als zuvor (-30) → kompaktere Breite je Label
  const PLOT_HEIGHT = 180; // reine Balkenfläche, unabhängig von der Labelhöhe
  const { axisHeight, chartHeight } = React.useMemo(() => {
    if (!compact) return { axisHeight: 28, chartHeight: PLOT_HEIGHT + 28 };
    const labels = data.map((d) => shortName(d.label));
    const maxLen = Math.max(0, ...labels.map((l) => l.length));
    const charPx = 7.2; // ~0.6em bei 12px Tick-Schrift (text-xs)
    const labelWidthPx = maxLen * charPx;
    const needed =
      Math.ceil(Math.sin((ANGLE_DEG * Math.PI) / 180) * labelWidthPx) + 18;
    const h = Math.min(140, Math.max(48, needed)); // sinnvolle Ober-/Untergrenze
    return { axisHeight: h, chartHeight: PLOT_HEIGHT + h };
  }, [compact, data]);

  // Klick auf einen Balken -> Tickets dieses Mitarbeiters (nur wenn id vorhanden).
  // Recharts liefert das Datum unter `payload`.
  function handleBarClick(entry: { payload?: CountDatum }) {
    const id = entry?.payload?.id;
    if (id != null) router.push(`/tickets/team?resource=${id}`);
  }

  return (
    // Karte füllt die (gestreckte) Grid-Spalte (h-full) – so ist sie genauso hoch wie
    // das „Meine Projekte"-Panel daneben. ABER die Plotfläche selbst ist FEST
    // (ChartContainer height={chartHeight}, NICHT h-full): so wachsen die Balken NICHT
    // mit einer hohen Nachbarspalte mit (war der „viel zu hoch"-Bug). Überschuss-Höhe
    // bleibt als Leerraum unter den Balken statt sie aufzublähen.
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Offene Tickets je zugewiesenem Mitarbeiter.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
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
          <ChartContainer
            config={chartConfig}
            className="aspect-auto w-full"
            style={{ height: chartHeight }}
          >
          <BarChart
            accessibilityLayer
            data={data}
            margin={{ top: 8 }}
            barCategoryGap="30%"
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={0}
              angle={compact ? -ANGLE_DEG : 0}
              textAnchor={compact ? "end" : "middle"}
              height={axisHeight}
              tickFormatter={compact ? shortName : undefined}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <ChartTooltip
              // Kein Recharts-„Einflug von links": NUR die Deckkraft wird überblendet
              // (kein transform-Transition – sonst gleitet der Tooltip beim ersten
              // Erscheinen aus der Ecke). So taucht er weich genau am Cursor auf.
              // Recharts-Positionsanimation AUS + keine Transform-Transition: der
              // Kasten erscheint immer hart am Cursor (kein Gleiten/„Einflug von
              // links"). Nur die Deckkraft wird kurz überblendet.
              isAnimationActive={false}
              wrapperStyle={{ transition: "opacity 120ms ease-out" }}
              content={<AnimatedTooltipContent />}
            />
            <Bar
              dataKey="count"
              fill="var(--color-count)"
              fillOpacity={0.7}
              activeBar={{ fillOpacity: 1 }}
              radius={[4, 4, 0, 0]}
              onClick={(d) => handleBarClick(d as { payload?: CountDatum })}
            />
          </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
