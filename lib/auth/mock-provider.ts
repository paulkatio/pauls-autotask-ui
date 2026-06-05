import "server-only";
import { cookies } from "next/headers";

import type { AuthProvider } from "@/lib/auth/provider";
import type { SessionUser } from "@/lib/auth/session";
import { MOCK_COOKIE, findMockUser } from "@/lib/auth/mock-users";

// Mock-Provider: liest die Dev-Auswahl aus dem Cookie und mappt über `userName`
// auf eine echte Sandbox-Resource. Aktiv nur bei AUTH_MODE=mock.
export const mockProvider: AuthProvider = {
  async getSession(): Promise<SessionUser | null> {
    const store = await cookies();
    const user = findMockUser(store.get(MOCK_COOKIE)?.value);
    if (!user) return null;
    return {
      id: user.userName,
      email: user.email,
      displayName: user.displayName,
      roles: user.roles,
      autotaskResourceId: user.autotaskResourceId,
    };
  },
};
