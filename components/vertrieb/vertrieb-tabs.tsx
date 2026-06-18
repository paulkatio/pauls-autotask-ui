"use client";

import { usePathname, useRouter } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Pfad-basierte Unterreiter des Vertriebsbereichs. Anders als UrlTabs (ein Pfad,
// ?tab=-Param) sind das DREI eigene Routen – der aktive Tab ergibt sich aus dem
// Pfad, der Wechsel navigiert. Liegt einmal im Section-Layout, bleibt also auch auf
// Detailseiten markiert (startsWith).
const TABS = [
  { value: "rechnungen", label: "Rechnungen" },
  { value: "vertraege", label: "Verträge" },
  { value: "angebote", label: "Angebote" },
];

// `heading` = unsichtbare H1 (a11y/Landmark) – sichtbar führt die aktive Tab-Leiste
// als Seitenüberschrift (kein doppeltes „Rechnungen"-H1 daneben).
export function VertriebTabs({ heading }: { heading?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const active =
    TABS.find((t) => pathname.startsWith(`/vertrieb/${t.value}`))?.value ??
    "rechnungen";

  return (
    <Tabs value={active} onValueChange={(v) => router.push(`/vertrieb/${String(v)}`)}>
      {heading && <h1 className="sr-only">{heading}</h1>}
      {/* Segmentiert (aktiver Tab im Vordergrund = erhabener Pill). h-auto + flex-wrap:
          mehrere Tabs brechen sauber in eine zweite Zeile um, statt zu überlaufen. */}
      <TabsList className="group-data-horizontal/tabs:h-auto max-w-full flex-wrap justify-start gap-1">
        {TABS.map((t) => (
          <TabsTrigger
            key={t.value}
            value={t.value}
            className="h-11 flex-1 sm:h-9 sm:flex-none"
          >
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
