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
  // secure nur in Produktion: lokal (http) würde der Browser ein secure-Cookie
  // verwerfen und der Mock-Login bräche. Über HTTPS (Prod) ist es Pflicht.
  secure: process.env.NODE_ENV === "production",
};

// Login im Mock-Modus: setzt die Auswahl als Cookie und leitet zur App.
// Hart auf den Mock-Modus begrenzt – im Entra-/Prod-Modus existiert dieser Pfad
// effektiv nicht (Defense-in-depth, Sicherheits-Audit): so lässt sich auch durch
// direktes Aufrufen der Server-Action keine Mock-Identität erschleichen.
export async function loginAs(formData: FormData) {
  if (authMode() !== "mock") redirect("/login");
  const userName = String(formData.get("userName") ?? "");
  if (findMockUser(userName)) {
    (await cookies()).set(MOCK_COOKIE, userName, cookieOptions);
  }
  redirect("/");
}

// Umschalten zwischen Mock-Usern (Header-Dropdown). Nur im Mock-Modus wirksam.
export async function switchMockUser(userName: string) {
  if (authMode() !== "mock") return;
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
