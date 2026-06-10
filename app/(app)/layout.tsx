import { AppSidebar } from "@/components/app-sidebar";
import { CommandPalette } from "@/components/command-palette";
import { ContactModal } from "@/components/contacts/contact-modal";
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
import { mockUsers } from "@/lib/auth/mock-users";
import { getOrgName } from "@/lib/branding-server";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // requireSession() leitet selbst um (/login bzw. /no-access im Entra-Modus).
  const session = await requireSession();
  const orgName = await getOrgName();

  const isMock = authMode() === "mock";
  const switcherUsers = mockUsers.map((u) => ({
    userName: u.userName,
    displayName: u.displayName,
  }));

  return (
    <SidebarProvider>
      <AppSidebar user={session} orgName={orgName} />
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
              {/* Mobil: Sidebar-Trigger rechts (öffnet die Leiste von rechts, passend
                  zum „Mehr"-Tab unten rechts). Desktop nutzt den linken Trigger. */}
              <SidebarTrigger className="size-11 md:hidden" />
            </div>
          </div>
        </header>
        {/* Mobil unten Platz für die feste Bottom-Nav (h-14 = 3.5rem) + 1rem Luft +
            Safe-Area freihalten, damit die letzte Zeile/der letzte Button nicht an der
            Leiste klebt. Padding ist mobil immer da → kein Layout-Sprung. */}
        <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
          {children}
        </div>
        <MobileBottomNav />
      </SidebarInset>
      <CommandPalette />
      <ContactModal />
      <Toaster />
    </SidebarProvider>
  );
}
