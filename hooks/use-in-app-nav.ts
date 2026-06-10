import * as React from "react";

import { isStandaloneOrMobile } from "@/lib/standalone";

// Reaktive Variante von isStandaloneOrMobile() – nach dem Muster von use-mobile.ts.
// Start undefined → erster (SSR-sicherer) Wert ist false; nach Mount korrekt.
// Abonniert display-mode, pointer und resize, damit ein Wechsel (z. B. PWA-Start,
// Drehen, Fensterbreite) den Wert nachzieht.
export function useInAppNav(): boolean {
  const [inApp, setInApp] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const update = () => setInApp(isStandaloneOrMobile());
    update();

    const displayMq = window.matchMedia("(display-mode: standalone)");
    const pointerMq = window.matchMedia("(pointer: coarse)");
    displayMq.addEventListener("change", update);
    pointerMq.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      displayMq.removeEventListener("change", update);
      pointerMq.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return !!inApp;
}
