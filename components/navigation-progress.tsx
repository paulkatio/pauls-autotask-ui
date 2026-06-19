"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Progress as ProgressPrimitive } from "@base-ui/react/progress";

import { ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { navProgress } from "@/lib/nav-progress";

// Dezenter, globaler Ladebalken am oberen Rand – das EINE Signal „es lädt gerade",
// das bei JEDER Navigation erscheint (Routenwechsel wie Filter-/Tab-Wechsel), damit
// nichts eingefroren wirkt. Aufgebaut aus der shadcn-Progress-Primitive (Track +
// Indicator), nur semantische Tokens.
//
// Quellen für „Navigation läuft":
//   - globaler Anker-Klick-Listener hier (deckt ALLE <Link> ab, ohne sie anzufassen),
//   - programmatische Navigation über useProgressNav() (Tabs/Filter/Datensatz).
// Beendet wird beim Routen-/Parameter-Commit (pathname/searchParams ändern sich) oder
// per Sicherheits-Timeout, falls eine Navigation nie ankommt.

const TRICKLE_MS = 200;
const SAFETY_MS = 10000;

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = React.useSyncExternalStore(
    navProgress.subscribe,
    navProgress.getActive,
    () => false,
  );

  const [progress, setProgress] = React.useState(0);
  const [visible, setVisible] = React.useState(false);

  // Navigation ist angekommen, sobald sich Pfad ODER Query ändern -> beenden.
  // (deckt sowohl Routenwechsel als auch reine ?param=-Wechsel ab.)
  React.useEffect(() => {
    navProgress.done();
  }, [pathname, searchParams]);

  // Während aktiv: einblenden und „trickeln" (asymptotisch Richtung 90 %, kommt nie
  // ganz an – der echte Abschluss setzt auf 100). Sicherheits-Timeout gegen Hänger.
  /* eslint-disable react-hooks/set-state-in-effect -- bewusste Lade-Animation:
     Einblenden + Trickle-Start nach Aktivierung, kein Render-Footgun. */
  React.useEffect(() => {
    if (!active) return;
    setVisible(true);
    setProgress((p) => (p < 12 ? 12 : p));
    const id = setInterval(() => {
      setProgress((p) => (p < 90 ? p + (90 - p) * 0.12 : p));
    }, TRICKLE_MS);
    const safety = setTimeout(() => navProgress.done(), SAFETY_MS);
    return () => {
      clearInterval(id);
      clearTimeout(safety);
    };
  }, [active]);

  // Nach Abschluss: auf 100 % füllen, kurz halten, dann ausblenden und zurücksetzen.
  React.useEffect(() => {
    if (active || !visible) return;
    setProgress(100);
    const t = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 220);
    return () => clearTimeout(t);
  }, [active, visible]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60]"
    >
      <ProgressPrimitive.Root value={progress} className="block w-full">
        <ProgressTrack className="h-0.5 rounded-none bg-transparent">
          <ProgressIndicator className="transition-[width] duration-200 ease-out" />
        </ProgressTrack>
      </ProgressPrimitive.Root>
    </div>
  );
}

// Globaler Anker-Klick-Listener: startet den Balken bei jedem echten internen
// <Link>-Klick. Einmal gemountet (im NavigationProgress-Bereich), fasst KEINE der
// Link-Komponenten einzeln an. Programmatische Navigation läuft über useProgressNav.
export function NavigationProgressClickBridge() {
  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (
        !href ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return;
      }
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Gleiche URL -> keine Navigation -> kein Balken (sonst hinge er bis zum Timeout).
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      navProgress.start();
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
