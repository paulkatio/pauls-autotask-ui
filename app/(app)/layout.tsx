import { AppSidebar } from "@/components/app-sidebar";
import { CommandPalette } from "@/components/command-palette";
import { HeaderSearch } from "@/components/header-search";
import { HeaderTitle } from "@/components/header-title";
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

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // requireSession() leitet selbst um (/login bzw. /no-access im Entra-Modus).
  const session = await requireSession();

  const isMock = authMode() === "mock";
  const switcherUsers = mockUsers.map((u) => ({
    userName: u.userName,
    displayName: u.displayName,
  }));

  return (
    <SidebarProvider>
      <AppSidebar user={session} />
      <SidebarInset className="min-w-0">

        <header className="bg-background/80 supports-[backdrop-filter]:bg-background/65 sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b backdrop-blur">
          <div className="flex w-full items-center gap-2 px-4 md:px-6">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-1 data-[orientation=vertical]:h-5"
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
              <ThemeToggle />
            </div>
          </div>
        </header>
        <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">
          {children}
        </div>
      </SidebarInset>
      <CommandPalette />
      <Toaster />
    </SidebarProvider>
  );
}
