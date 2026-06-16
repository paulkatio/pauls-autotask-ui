import * as React from "react"

const MOBILE_BREAKPOINT = 768

// useSyncExternalStore ist das von React empfohlene Muster, um an einen externen
// Store (hier matchMedia) zu abonnieren – ohne setState im Effect-Body und
// SSR-sicher (Server liefert false, Client hydriert auf den echten Wert).
export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT) {
  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
      mql.addEventListener("change", onStoreChange)
      return () => mql.removeEventListener("change", onStoreChange)
    },
    [breakpoint],
  )

  return React.useSyncExternalStore(
    subscribe,
    () => window.innerWidth < breakpoint, // Client
    () => false, // Server: kein window -> nicht mobil
  )
}
