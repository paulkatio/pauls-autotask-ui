"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboardIcon,
  MenuIcon,
  SearchIcon,
  TicketIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { OPEN_COMMAND_PALETTE } from "@/components/command-palette";
import { isActiveRoute } from "@/components/nav-main";
import { cn } from "@/lib/utils";

// Persistente Tab-Leiste unten – nur mobil (md:hidden). Gibt der installierten PWA
// das native App-Gefühl. Zusammengesetzt aus shadcn-Button + Link + lucide-Icons
// und semantischen Tokens (kein erfundenes Styling). „Suche" öffnet die im Layout
// gemountete Command-Palette, „Mehr" öffnet die bestehende Sidebar-Sheet
// (Firmen/Kontakte/Zeiten/Profil/Theme) – so bleibt alles erreichbar ohne die
// Leiste zu überladen. Labels bewusst kurz (Paul) für sauberen, engen Tab-Look.

type Tab =
  | { kind: "link"; label: string; href: string; icon: LucideIcon }
  | { kind: "action"; label: string; action: "search" | "more"; icon: LucideIcon };

const TABS: Tab[] = [
  { kind: "link", label: "Übersicht", href: "/", icon: LayoutDashboardIcon },
  { kind: "link", label: "Meine", href: "/tickets/my", icon: TicketIcon },
  { kind: "link", label: "Team", href: "/tickets/team", icon: UsersIcon },
  { kind: "action", label: "Suche", action: "search", icon: SearchIcon },
  { kind: "action", label: "Mehr", action: "more", icon: MenuIcon },
];

const tabClass =
  "flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-none px-0 text-xs font-normal [&>svg]:size-5";

// Kompakte Mobile-Variante (wenig Platz): ab 100 -> „99+".
function fmtBadge(n: number): string {
  return n > 99 ? "99+" : String(n);
}

export function MobileBottomNav({
  ticketCounts,
}: {
  // Offene-Tickets-Zähler (mir / Team) für die kleinen Badges an „Meine"/„Team".
  ticketCounts?: { mine: number; team: number };
}) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  function badgeFor(href: string): number | undefined {
    if (href === "/tickets/my") return ticketCounts?.mine;
    if (href === "/tickets/team") return ticketCounts?.team;
    return undefined;
  }

  return (
    <nav
      aria-label="Hauptnavigation"
      className="bg-background fixed inset-x-0 bottom-0 z-40 flex border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {TABS.map((tab) => {
        if (tab.kind === "link") {
          const active = isActiveRoute(pathname, tab.href);
          const badge = badgeFor(tab.href);
          return (
            <Button
              key={tab.href}
              variant="ghost"
              nativeButton={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                tabClass,
                active ? "text-primary" : "text-muted-foreground",
              )}
              render={<Link href={tab.href} />}
            >
              <span className="relative inline-flex">
                <tab.icon />
                {badge != null && badge > 0 && (
                  // Kleiner, dezenter Zähler am Icon (gefüllter Stahlblau-Akzent,
                  // gut lesbar; hell + dunkel über semantische Tokens).
                  <span className="bg-chart-2 text-background pointer-events-none absolute -top-1.5 -right-4.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-medium tabular-nums">
                    {fmtBadge(badge)}
                  </span>
                )}
              </span>
              <span className="max-w-full truncate leading-none">{tab.label}</span>
            </Button>
          );
        }
        return (
          <Button
            key={tab.action}
            variant="ghost"
            className={cn(tabClass, "text-muted-foreground")}
            onClick={() => {
              if (tab.action === "search") {
                window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE));
              } else {
                setOpenMobile(true);
              }
            }}
          >
            <tab.icon />
            <span>{tab.label}</span>
          </Button>
        );
      })}
    </nav>
  );
}
