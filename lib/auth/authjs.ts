import "server-only";

import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

import { resources } from "@/lib/autotask/entities/resources";

// Auth.js v5 (Microsoft Entra ID, reines OIDC-Sign-in). JWT-Session = stateless,
// keine DB -> deployment-agnostisch (Hetzner/Docker hinter Caddy UND Vercel).
// Liest ENTRA_CLIENT_ID / ENTRA_CLIENT_SECRET / ENTRA_TENANT_ID + AUTH_SECRET aus
// der Umgebung. Der tenant-spezifische Issuer beschränkt den Login auf die eigene
// Organisation (nur Org-Konten, keine privaten MS-Accounts). Nur server-seitig
// (server-only); kein middleware.ts.
//
// Beim Sign-in wird die E-Mail aus dem ID-Token auf eine Autotask-Resource
// gemappt und das Ergebnis im JWT gecacht (kein Query pro Request). Kein Treffer
// -> atError "NO_RESOURCE" (es wird NIE eine resourceId fabriziert).
const entraTenantId = process.env.ENTRA_TENANT_ID;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.ENTRA_CLIENT_ID,
      clientSecret: process.env.ENTRA_CLIENT_SECRET,
      issuer: entraTenantId
        ? `https://login.microsoftonline.com/${entraTenantId}/v2.0`
        : undefined,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, profile, user }) {
      const t = token as Record<string, unknown>;
      // Nur beim initialen Sign-in (account vorhanden) auflösen + cachen.
      if (account && profile) {
        const p = profile as Record<string, unknown>;
        // Profilbild: der Entra-Provider holt das Graph-Foto (48×48) und liefert es
        // als base64-data-URI in user.image. Im JWT cachen (kein Graph-Call/Request).
        // Der Provider setzt „data:image/jpeg;base64, <…>" MIT Leerzeichen nach dem
        // Komma – das ist im Data-URI ungültig und bricht das Rendern in manchen
        // Browsern. Leerzeichen direkt nach „base64," entfernen.
        const rawImage = (user?.image as string | null | undefined) ?? null;
        t.picture = rawImage ? rawImage.replace(/;base64,\s+/, ";base64,") : null;
        const claim =
          (p.email as string | undefined) ??
          (p.preferred_username as string | undefined) ??
          (p.upn as string | undefined) ??
          "";
        const email = claim.trim();
        const name = (p.name as string | undefined) ?? email;
        t.email = email;
        t.oid = (p.oid as string | undefined) ?? token.sub;

        const res = email ? await resources.byEmail(email) : null;
        if (res) {
          t.autotaskResourceId = res.id;
          t.displayName = res.name || name;
          t.atError = undefined;
        } else {
          t.autotaskResourceId = undefined;
          t.displayName = name;
          t.atError = "NO_RESOURCE";
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Token-Felder auf session.user spiegeln (der entra-provider liest sie hier).
      const t = token as Record<string, unknown>;
      if (session.user) {
        const u = session.user as unknown as Record<string, unknown>;
        u.id = (t.oid as string | undefined) ?? u.id;
        u.email = (t.email as string | undefined) ?? u.email;
        u.displayName = t.displayName as string | undefined;
        u.autotaskResourceId = t.autotaskResourceId as number | undefined;
        u.atError = t.atError as string | undefined;
        u.avatarUrl = (t.picture as string | null | undefined) ?? null;
      }
      return session;
    },
  },
});
