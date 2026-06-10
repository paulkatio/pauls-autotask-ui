// Erkennung, ob die App "wie eine App" laufen soll (installierte PWA oder mobiles
// Gerät) – dann wird ein Datensatz IN der App geöffnet (router.push) statt in einem
// eigenen Browser-Fenster (window.open). In einer Standalone-PWA bricht window.open
// aus der App aus und reißt einen Browser-Tab auf; das wollen wir verhindern.
//
// Prädikat bewusst konservativ, damit Touch-Laptops/Tablets im normalen
// Desktop-Browser NICHT versehentlich In-App-Navigation bekommen:
//   - Standalone-PWA (display-mode oder iOS navigator.standalone) → IMMER in-App
//   - schmale Breite (< 768) → in-App
//   - grober Zeiger (Touch) NUR kombiniert mit schmaler Breite (< 1024) → in-App

// Läuft die App als installierte PWA (eigenes Fenster ohne Browser-Chrome)?
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const displayMode =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  // iOS Safari: nicht-standardisiertes navigator.standalone.
  const iosStandalone =
    "standalone" in window.navigator &&
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true;
  return Boolean(displayMode || iosStandalone);
}

// Soll IN der App navigiert werden (statt Pop-out-Fenster)?
export function isStandaloneOrMobile(): boolean {
  if (typeof window === "undefined") return false;
  if (isStandalone()) return true;
  const width = window.innerWidth;
  if (width < 768) return true;
  const coarse =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  return coarse && width < 1024;
}
