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
              // Inaktiv = gedämpfte Sidebar-Vordergrundfarbe (Primitive-Default).
              // Aktiv = sidebar-accent-Fläche + kräftigere accent-foreground-Schrift
              // + font-medium + Akzent-Icon (primary = Theme-Hauptakzent). Klar
              // erkennbar wo man ist, AA in Hell UND Dunkel. Nur semantische Tokens,
              // kein erfundenes CSS / keine festen Farben. Farbsystem v2.
              // Im eingeklappten Icon-Modus erzwingt sidebar.tsx weiter 8er-Quadrate.
              className="h-10 gap-3 transition-colors data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground data-active:font-medium [&>svg]:size-5 data-active:[&>svg]:text-primary"
              onClick={() => setOpenMobile(false)}
              render={<Link href={item.url} />}
            >
              <item.icon />
              <span>{item.title}</span>
            </SidebarMenuButton>
            {item.badge != null && item.badge > 0 && (
              // Kleiner, neutraler Pill über Token-Farben (muted); im Icon-Modus
              // blendet der Primitive den Badge selbst aus.
              <SidebarMenuBadge className="top-1/2! -translate-y-1/2! bg-muted text-muted-foreground tabular-nums">
                {fmtBadge(item.badge)}
              </SidebarMenuBadge>
            )}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
