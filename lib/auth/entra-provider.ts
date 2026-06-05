import "server-only";

import type { AuthProvider } from "@/lib/auth/provider";
import type { SessionUser } from "@/lib/auth/session";

// Entra-Provider (B16): liest die Auth.js-Session und mappt sie auf die EINE
// SessionUser-Form. Auth.js wird LAZY importiert, damit der Mock-Modus die
// Library nie lädt. NO_RESOURCE/keine resourceId -> null (keine halbe Session);
// die Unterscheidung „eingeloggt ohne Resource" trifft requireSession().
export const entraProvider: AuthProvider = {
  async getSession(): Promise<SessionUser | null> {
    const { auth } = await import("@/lib/auth/authjs");
    const session = await auth();
    const u = session?.user as
      | {
          id?: string;
          email?: string;
          displayName?: string;
          autotaskResourceId?: number;
          atError?: string;
        }
      | undefined;
    if (!u) return null;
    if (u.atError || u.autotaskResourceId == null || !u.email) return null;

    return {
      id: u.id ?? u.email,
      email: u.email,
      displayName: u.displayName || u.email,
      roles: ["agent"], // kein Gating (B12); später optional aus Entra-App-Rollen
      autotaskResourceId: u.autotaskResourceId,
    };
  },
};
