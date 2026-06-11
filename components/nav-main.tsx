"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export type NavItem = {
  title: string
  url: string
  icon: LucideIcon
  // Optionaler Zähler-Badge (z. B. Anzahl offener Tickets). Bei 0/undefined ausgeblendet.
  badge?: number
}

// Große Zahlen kompakt halten (Badge soll nicht die Beschriftung verdrängen).
function fmtBadge(n: number): string {
  return n > 999 ? "999+" : String(n)
}

export function isActiveRoute(pathname: string, url: string) {
  // "/" nur exakt aktiv; verschachtelte Routen auch bei Unterpfaden.
  return url === "/" ? pathname === "/" : pathname.startsWith(url)
}

export function NavMain({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.url}>
            <SidebarMenuButton
              tooltip={item.title}
              isActive={isActiveRoute(pathname, item.url)}
              // Aktiv = dezenter neutraler Pill (primary/10 = Warm-Schwarz-Tint)
              // + Akzent-Icon (primary) + kontraststarke Beschriftung (klar
              // erkennbar wo man ist, AA-konform in Hell UND Dunkel); Hover bleibt
              // neutral (sidebar-accent). Nur semantische Tokens + Opacity-
              // Utilities, kein erfundenes CSS. Farbsystem v2 (warm-achromatisch).
              // Komfortable Touch-Ziele: etwas höher (h-10) + größeres Icon + mehr
              // Abstand. Im eingeklappten Icon-Modus erzwingt sidebar.tsx weiter 8er-Quadrate.
              className="h-10 gap-3 transition-colors data-active:bg-primary/10 data-active:hover:bg-primary/15 [&>svg]:size-5 data-active:[&>svg]:text-primary"
              onClick={() => setOpenMobile(false)}
              render={<Link href={item.url} />}
            >
              <item.icon />
              <span>{item.title}</span>
            </SidebarMenuButton>
            {item.badge != null && item.badge > 0 && (
              // Dezenter Pill in Sidebar-Tokens; im Icon-Modus blendet der Primitive
              // den Badge selbst aus (group-data-[collapsible=icon]:hidden).
              <SidebarMenuBadge className="top-1/2! -translate-y-1/2! bg-chart-2/15 text-chart-2">
                {fmtBadge(item.badge)}
              </SidebarMenuBadge>
            )}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
