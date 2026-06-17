"use client"

// Quelle: shadcn-Block "sidebar-07" (Registry @shadcn) – per CLI hinzugefügt.
// Angepasst: TeamSwitcher + NavProjects entfernt, Demo-Daten gegen unsere 5 Routen
// getauscht, NavMain auf flache Links (offizielle Sidebar-Primitiven) reduziert.

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
// Statischer Import: Next vergibt eine inhalts-gehashte URL → ein ausgetauschtes
// Logo-Bild bricht Browser-/Optimizer-Cache automatisch (keine veraltete Anzeige).
import autotaskLogo from "../public/autotask-logo.png"
import {
  LayoutDashboardIcon,
  TicketIcon,
  UsersIcon,
  FolderKanbanIcon,
  Building2Icon,
  ContactIcon,
  ClockIcon,
  BriefcaseBusinessIcon,
} from "lucide-react"

import { NavMain, type NavItem } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import type { SessionUser } from "@/lib/auth/session"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

// Navigationsrouten der App. Rollen-Gating ist AUFGESCHOBEN (Entscheidung bei B12):
// aktuell sehen alle Nutzer dieselbe Ansicht, alle Links sichtbar. `SessionUser.roles`
// bleibt als Weiche im Datenmodell, wird hier aber (noch) nicht ausgewertet.
const navItems: NavItem[] = [
  { title: "Übersicht", url: "/", icon: LayoutDashboardIcon },
  { title: "Meine Tickets", url: "/tickets/my", icon: TicketIcon },
  { title: "Teamtickets", url: "/tickets/team", icon: UsersIcon },
  { title: "Projekte", url: "/projekte", icon: FolderKanbanIcon },
  { title: "Firmen", url: "/companies", icon: Building2Icon },
  { title: "Kontakte", url: "/contacts", icon: ContactIcon },
  { title: "Meine Zeiten", url: "/zeiten", icon: ClockIcon },
]

export function AppSidebar({
  user,
  orgName,
  ticketCounts,
  showSales,
  ...props
}: {
  user: SessionUser
  orgName: string
  // Offene-Tickets-Zähler für die Badges (mir zugewiesen / Team). Optional –
  // schlägt die Zählung fehl, bleibt die Sidebar einfach ohne Badge.
  ticketCounts?: { mine: number; team: number }
  // Zugriff auf den Vertriebsbereich (Rechnungen/Verträge/Angebote). Server berechnet
  // das Flag (lib/auth/sales-access); nur dann erscheint der Nav-Eintrag.
  showSales?: boolean
} & React.ComponentProps<typeof Sidebar>) {
  const items: NavItem[] = navItems.map((it) =>
    it.url === "/tickets/my"
      ? { ...it, badge: ticketCounts?.mine }
      : it.url === "/tickets/team"
        ? { ...it, badge: ticketCounts?.team }
        : it,
  )
  if (showSales) {
    // Direkt nach „Projekte" einsortieren (vor Firmen/Kontakte/Zeiten).
    const at = items.findIndex((it) => it.url === "/projekte")
    const entry: NavItem = {
      title: "Vertrieb",
      url: "/vertrieb",
      icon: BriefcaseBusinessIcon,
    }
    items.splice(at >= 0 ? at + 1 : items.length, 0, entry)
  }
  return (
    <Sidebar collapsible="icon" mobileSide="right" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" aria-label="Autotask UI – Startseite" />}
            >
              <Image
                src={autotaskLogo}
                alt="Autotask"
                width={32}
                height={32}
                priority
                className="size-8 shrink-0 rounded-sm"
              />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Autotask UI</span>
                <span className="truncate text-xs">{orgName}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={items} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: user.displayName,
            email: user.email,
            avatar: user.avatarUrl ?? "",
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
