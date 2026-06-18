"use client";

import { useRouter } from "next/navigation";
import { CaretUpDown, User } from "@phosphor-icons/react/ssr";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { switchMockUser } from "@/lib/auth/actions";

type Option = { userName: string; displayName: string };

// Nur im Mock-Modus gerendert: schneller Wechsel zwischen Sandbox-Usern.
export function MockUserSwitcher({
  users,
  currentUserName,
}: {
  users: Option[];
  currentUserName: string;
}) {
  const router = useRouter();
  const current = users.find((u) => u.userName === currentUserName);

  async function select(userName: string) {
    await switchMockUser(userName);
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" className="h-11 sm:h-9" />}
        aria-label="Benutzer wechseln"
      >
        <User data-icon="inline-start" />
        {/* Name erst ab sm zeigen – auf schmalen Headern nur Icon, damit der
            Seitentitel nicht verdrängt wird. */}
        <span className="hidden sm:inline">
          {current?.displayName ?? "Benutzer"}
        </span>
        <CaretUpDown data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Mock-Benutzer wechseln</DropdownMenuLabel>
          {users.map((u) => (
            <DropdownMenuItem
              key={u.userName}
              onClick={() => select(u.userName)}
            >
              {u.displayName}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
