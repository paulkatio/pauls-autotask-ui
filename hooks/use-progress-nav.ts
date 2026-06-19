"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { navProgress } from "@/lib/nav-progress";

// Programmatische Navigation MIT sofortigem Feedback. Startet den globalen
// Fortschrittsbalken ([components/navigation-progress.tsx]) und liefert zusätzlich
// `pending` zurück – damit die auslösende Komponente ihren Inhalt lokal abdimmen
// kann (z. B. eine Liste beim Filter-/Tab-Wechsel). Der Balken wird beim Routen-/
// Parameter-Commit automatisch wieder beendet.
export function useProgressNav() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const navigate = React.useCallback(
    (href: string, opts?: { replace?: boolean }) => {
      navProgress.start();
      startTransition(() => {
        if (opts?.replace) router.replace(href);
        else router.push(href);
      });
    },
    [router],
  );

  return { navigate, pending };
}
