import { AppSidebar } from "@/components/app-sidebar";
import { CommandPalette } from "@/components/command-palette";
import { ContactModal } from "@/components/contacts/contact-modal";
import { HeaderAutotaskLink } from "@/components/header-autotask-link";
import { HeaderBack } from "@/components/header-back";
import { HeaderLogo } from "@/components/header-logo";
import { HeaderSearch } from "@/components/header-search";
import { HeaderTitle } from "@/components/header-title";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Toaster } from "@/components/ui/sonner";
import { MockUserSwitcher } from "@/components/mock-user-switcher";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { requireSession, authMode } from "@/lib/auth";
import { canAccessSales } from "@/lib/auth/sales-access";
import { mockUsers } from "@/lib/auth/mock-users";
import { getOrgName } from "@/lib/branding-server";
import { autotaskWebBase } from "@/lib/autotask/links";
import { getSidebarTicketCounts } from "@/lib/autotask/entities/ticket-counts";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // requireSession() leitet selbst um (/login bzw. /no-access im Entra-Modus).
  const session = await requireSession();
  const orgName = await getOrgName();

  const isMock = authMode() === "mock";
  const webBase = autotaskWebBase();
  // Vertriebsbereich nur für berechtigte Resourcen (siehe lib/auth/sales-access).
  const showSales = canAccessSales(session);

  // Offene-Tickets-Zähler für die Sidebar-Badges (best effort: nie die App kippen).
  let ticketCounts: { mine: number; team: number } | undefined;
  try {
    ticketCounts = await getSidebarTicketCounts(session.autotaskResourceId);
  } catch {
    ticketCounts = undefined;
  }
  const switcherUsers = mockUsers.map((u) => ({
    userName: u.userName,
    displayName: u.displayName,
  }));

  return (
    <SidebarProvider>
      <AppSidebar
        user={session}
        orgName={orgName}
        ticketCounts={ticketCounts}
        showSales={showSales}
      />
      <SidebarInset className="min-w-0">

        <header className="bg-background/80 supports-[backdrop-filter]:bg-background/65 sticky top-0 z-30 flex min-h-16 shrink-0 items-center gap-2 border-b pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="flex w-full items-center gap-2 px-4 md:px-6">
            {/* Mobil: Logo links (Listen) bzw. Zurück-Button allein (Detailseiten).
                Desktop: Sidebar-Trigger (klappt die Icon-Leiste) + Trenner. */}
            <HeaderLogo />
            <HeaderBack />
            <SidebarTrigger className="-ml-1 hidden md:flex" />
            <Separator
              orientation="vertical"
              className="mr-1 hidden data-[orientation=vertical]:h-5 md:block"
            />
            <HeaderTitle />
            <div className="ml-auto flex items-center gap-2">
              <HeaderSearch />
              {isMock && (
                <MockUserSwitcher
                  users={switcherUsers}
                  currentUserName={session.id}
                />
              )}
              {/* Auf Mobile sitzt der Theme-Umschalter im Benutzermenü (NavUser). */}
              <span className="hidden md:inline-flex">
                <ThemeToggle />
              </span>
              {/* Mobil rechts: „In Autotask öffnen" (nur auf Detailrouten). Der frühere
                  Sidebar-Trigger ist hier entfallen – die Sidebar öffnet der „Mehr"-Tab
                  der Bottom-Nav. Desktop nutzt weiter den linken Trigger. */}
              <HeaderAutotaskLink webBase={webBase} />
            </div>
          </div>
        </header>
        {/* Mobil unten Platz für die feste Bottom-Nav (h-14 = 3.5rem) + 1rem Luft +
            Safe-Area freihalten, damit die letzte Zeile/der letzte Button nicht an der
            Leiste klebt. Padding ist mobil immer da → kein Layout-Sprung. */}
        <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
          {children}
        </div>
        <MobileBottomNav ticketCounts={ticketCounts} />
      </SidebarInset>
      <CommandPalette />
      <ContactModal />
      <Toaster />
    </SidebarProvider>
  );
}
