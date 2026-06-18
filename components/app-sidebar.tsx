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
  SquaresFour,
  Ticket,
  Users,
  Kanban,
  Buildings,
  AddressBook,
  Clock,
  Briefcase,
} from "@phosphor-icons/react/ssr"

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

// Navigationsrouten der App, in zwei dezente Gruppen geteilt. Rollen-Gating ist
// AUFGESCHOBEN (Entscheidung bei B12): aktuell sehen alle Nutzer dieselbe Ansicht,
// alle Links sichtbar. `SessionUser.roles` bleibt als Weiche im Datenmodell, wird
// hier aber (noch) nicht ausgewertet.
const workItems: NavItem[] = [
  { title: "Übersicht", url: "/", icon: SquaresFour },
  { title: "Meine Tickets", url: "/tickets/my", icon: Ticket },
  { title: "Teamtickets", url: "/tickets/team", icon: Users },
  { title: "Projekte", url: "/projekte", icon: Kanban },
  { title: "Meine Zeiten", url: "/zeiten", icon: Clock },
]
const crmItems: NavItem[] = [
  { title: "Firmen", url: "/companies", icon: Buildings },
  { title: "Kontakte", url: "/contacts", icon: AddressBook },
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
  // Gruppe „Arbeit": Zähler-Badges (mir zugewiesen / Team) anheften.
  const work: NavItem[] = workItems.map((it) =>
    it.url === "/tickets/my"
      ? { ...it, badge: ticketCounts?.mine }
      : it.url === "/tickets/team"
        ? { ...it, badge: ticketCounts?.team }
        : it,
  )
  // Gruppe „CRM": Vertrieb nur bei Zugriff, vorangestellt vor Firmen/Kontakte.
  const crm: NavItem[] = showSales
    ? [{ title: "Vertrieb", url: "/vertrieb", icon: Briefcase }, ...crmItems]
    : crmItems
  return (
    <Sidebar collapsible="icon" mobileSide="right" {...props}>
      {/* Feine Hairline (0,5px) unter dem Logo-Bereich; Farbe über das Border-Token. */}
      <SidebarHeader className="border-b-[0.5px] border-sidebar-border">
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
        <NavMain label="Arbeit" items={work} />
        <NavMain label="CRM" items={crm} />
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
