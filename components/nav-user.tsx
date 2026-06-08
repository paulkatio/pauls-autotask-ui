"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import * as React from "react"
import { ChevronsUpDownIcon, BadgeCheckIcon, BellIcon, HistoryIcon, LogOutIcon } from "lucide-react"

import { useTheme } from "next-themes"

import { logout } from "@/lib/auth/actions"
import { HistorySheet } from "@/components/history-sheet"

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
  const { isMobile } = useSidebar()
  const { theme, setTheme } = useTheme()
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const initials =
    user.name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <Avatar>
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs">{user.email}</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-fit"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar>
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {/* Platzhalter bis B04 (Mock-Provider / echte Session). */}
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <BadgeCheckIcon />
                Konto
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setHistoryOpen(true)}>
                <HistoryIcon />
                Verlauf
              </DropdownMenuItem>
              <DropdownMenuItem>
                <BellIcon />
                Benachrichtigungen
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={theme ?? "system"}
              onValueChange={setTheme}
            >
              <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
                Design
              </DropdownMenuLabel>
              <DropdownMenuRadioItem value="light">Hell</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">Dunkel</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()}>
              <LogOutIcon />
              Abmelden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Verlauf-Sheet steuerbar aus dem Menü heraus (kein eigener Header-Button). */}
        <HistorySheet
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          showTrigger={false}
        />
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
