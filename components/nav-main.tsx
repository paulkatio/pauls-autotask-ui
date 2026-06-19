"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { Icon } from "@phosphor-icons/react"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export type NavItem = {
  title: string
  url: string
  icon: Icon
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

export function NavMain({ items, label }: { items: NavItem[]; label?: string }) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

  return (
    <SidebarGroup>
      {label && (
        // Gruppen-Label: der Primitive liefert schon text-xs / font-medium /
        // text-sidebar-foreground/70 (gedämpft) + Icon-Modus-Ausblendung; hier nur
        // etwas Laufweite ergänzt. Im eingeklappten Modus blendet es selbst aus.
        <SidebarGroupLabel className="tracking-wide">{label}</SidebarGroupLabel>
      )}
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.url}>
            <SidebarMenuButton
              tooltip={item.title}
              isActive={isActiveRoute(pathname, item.url)}
              // Inaktiv = Label bleibt sidebar-foreground, Icon einen Tick heller
              // (muted-foreground) → ruhige Hierarchie zwischen Icon und Text.
              // Aktiv = sidebar-accent-Fläche + kräftigere accent-foreground-Schrift
              // + font-medium + Akzent-Icon (primary = Theme-Hauptakzent). Klar
              // erkennbar wo man ist, AA in Hell UND Dunkel. Nur semantische Tokens,
              // kein erfundenes CSS / keine festen Farben. Farbsystem v2.
              // Im eingeklappten Icon-Modus erzwingt sidebar.tsx weiter 8er-Quadrate.
              className="h-11 gap-3 transition-colors [&>svg]:text-muted-foreground data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground data-active:font-medium [&>svg]:size-5 data-active:[&>svg]:text-primary sm:h-9 sm:[&>svg]:size-4"
              onClick={() => setOpenMobile(false)}
              render={<Link href={item.url} />}
            >
              <item.icon />
              <span>{item.title}</span>
            </SidebarMenuButton>
            {item.badge != null && item.badge > 0 && (
              // Kleiner, dezent farbiger Pill (tinted) – gleiches Muster wie die
              // Status-Badges: bg-info/10 + text-info (dark: bg-info/20). Im
              // Icon-Modus blendet der Primitive den Badge selbst aus.
              <SidebarMenuBadge className="top-1/2! -translate-y-1/2! bg-info/10 text-info dark:bg-info/20 tabular-nums">
                {fmtBadge(item.badge)}
              </SidebarMenuBadge>
            )}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
