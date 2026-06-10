"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export type NavItem = {
  title: string
  url: string
  icon: LucideIcon
}

export function isActiveRoute(pathname: string, url: string) {
  // "/" nur exakt aktiv; verschachtelte Routen auch bei Unterpfaden.
  return url === "/" ? pathname === "/" : pathname.startsWith(url)
}

export function NavMain({ items }: { items: NavItem[] }) {
  const pathname = usePathname()

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
              render={<Link href={item.url} />}
            >
              <item.icon />
              <span>{item.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
