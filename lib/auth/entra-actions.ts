"use server";

import { signIn, signOut } from "@/lib/auth/authjs";

// Startet den Entra-OIDC-Flow (Redirect zu Microsoft, dann zurück zur App).
export async function signInEntra() {
  await signIn("microsoft-entra-id", { redirectTo: "/" });
}

export async function signOutEntra() {
  await signOut({ redirectTo: "/login" });
}
