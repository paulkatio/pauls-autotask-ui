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
  ticketCountsPromise,
  showSales,
  ...props
}: {
  user: SessionUser
  orgName: string
  // Offene-Tickets-Zähler als PROMISE (Streaming): Die Badges blockieren die Sidebar
  // NICHT – sie erscheinen, sobald die Zählung da ist (verhindert den weißen
  // Kaltstart-Bildschirm). Fehlt/scheitert sie, bleibt die Nav ohne Badge.
  ticketCountsPromise?: Promise<{ mine: number; team: number } | null>
  // Zugriff auf den Vertriebsbereich (Rechnungen/Verträge/Angebote). Server berechnet
  // das Flag (lib/auth/sales-access); nur dann erscheint der Nav-Eintrag.
  showSales?: boolean
} & React.ComponentProps<typeof Sidebar>) {
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
        {/* „Arbeit"-Nav sofort sichtbar; die Zähler-Badges streamen per Suspense
            nach (Fallback = dieselbe Nav ohne Badges → kein Layout-Sprung, nur die
            Zahlen erscheinen). So blockt die Zählung den Kaltstart nicht. */}
        <React.Suspense fallback={<NavMain label="Arbeit" items={workItems} />}>
          <WorkNav promise={ticketCountsPromise} />
        </React.Suspense>
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

// Hängt die Zähler-Badges an die „Arbeit"-Nav. Eigene Komponente, damit NUR sie auf
// das Counts-Promise wartet (Suspense) – die übrige Sidebar bleibt sofort sichtbar.
function WorkNav({
  promise,
}: {
  promise?: Promise<{ mine: number; team: number } | null>
}) {
  const counts = promise ? React.use(promise) : null
  const work: NavItem[] = workItems.map((it) =>
    it.url === "/tickets/my"
      ? { ...it, badge: counts?.mine }
      : it.url === "/tickets/team"
        ? { ...it, badge: counts?.team }
        : it,
  )
  return <NavMain label="Arbeit" items={work} />
}
