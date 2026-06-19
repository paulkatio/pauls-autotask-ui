// Globaler Navigations-Indikator (rahmenlos, ohne Fremd-Lib). Hält EINEN Zustand:
// „läuft gerade eine Navigation?". Gespeist von zwei Quellen:
//   1. globaler Anker-Klick-Listener in <NavigationProgress/> (deckt ALLE <Link> ab),
//   2. programmatische Navigation über useProgressNav() (Tabs/Filter/Datensatz öffnen).
// Abgeschlossen wird beim Routen-/Parameter-Commit (pathname/searchParams ändern sich)
// bzw. über einen Sicherheits-Timeout, falls eine Navigation nie ankommt.
//
// Bewusst ein Modul-Singleton mit useSyncExternalStore statt Context: der Auslöser
// (Klick irgendwo in der App) und der Anzeiger (Balken im Layout) liegen weit
// auseinander – ein Store ohne Provider-Verkabelung ist hier am robustesten.

let active = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const navProgress = {
  // Navigation hat begonnen (Klick/Push). Idempotent.
  start() {
    if (!active) {
      active = true;
      emit();
    }
  },
  // Navigation ist angekommen (Commit) oder abgebrochen. Idempotent.
  done() {
    if (active) {
      active = false;
      emit();
    }
  },
  getActive() {
    return active;
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
