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

function isActiveRoute(pathname: string, url: string) {
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
              // Aktiv = dezenter Indigo-Pill + Indigo-Icon + fettere, kontrast-
              // starke Beschriftung (klar erkennbar wo man ist und AA-konform in
              // Hell UND Dunkel); Hover bleibt neutral (sidebar-accent). Nur
              // semantische Tokens + Opacity-Utilities, kein erfundenes CSS.
              className="transition-colors data-active:bg-primary/10 data-active:hover:bg-primary/15 data-active:[&>svg]:text-primary"
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
