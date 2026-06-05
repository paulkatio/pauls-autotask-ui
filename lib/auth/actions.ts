"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { MOCK_COOKIE, findMockUser } from "@/lib/auth/mock-users";
import { authMode } from "@/lib/auth";

const cookieOptions = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
};

// Login im Mock-Modus: setzt die Auswahl als Cookie und leitet zur App.
export async function loginAs(formData: FormData) {
  const userName = String(formData.get("userName") ?? "");
  if (findMockUser(userName)) {
    (await cookies()).set(MOCK_COOKIE, userName, cookieOptions);
  }
  redirect("/");
}

// Umschalten zwischen Mock-Usern (Header-Dropdown).
export async function switchMockUser(userName: string) {
  if (findMockUser(userName)) {
    (await cookies()).set(MOCK_COOKIE, userName, cookieOptions);
    revalidatePath("/", "layout");
  }
}

export async function logout() {
  if (authMode() === "entra") {
    // Auth.js-Abmeldung (lazy, damit der Mock-Modus die Library nicht lädt).
    const { signOutEntra } = await import("@/lib/auth/entra-actions");
    await signOutEntra();
    return;
  }
  (await cookies()).delete(MOCK_COOKIE);
  redirect("/login");
}
