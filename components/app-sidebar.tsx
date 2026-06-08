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
  Building2Icon,
  ContactIcon,
  ClockIcon,
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
  { title: "Dashboard", url: "/", icon: LayoutDashboardIcon },
  { title: "Meine Tickets", url: "/tickets/my", icon: TicketIcon },
  { title: "Teamtickets", url: "/tickets/team", icon: UsersIcon },
  { title: "Firmen", url: "/companies", icon: Building2Icon },
  { title: "Kontakte", url: "/contacts", icon: ContactIcon },
  { title: "Meine Zeiten", url: "/zeiten", icon: ClockIcon },
]

export function AppSidebar({
  user,
  orgName,
  ...props
}: {
  user: SessionUser
  orgName: string
} & React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
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
        <NavMain items={navItems} />
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
