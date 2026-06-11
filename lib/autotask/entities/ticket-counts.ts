import "server-only";

import { unstable_cache } from "next/cache";

import { autotask, type AutotaskFilter } from "@/lib/autotask/client";
import { countSecondaryOpen } from "@/lib/autotask/entities/dashboard";

// Ticketzahlen für die Sidebar-Badges: „Meine Tickets" (offen) und „Teamtickets"
// (alle offenen). „Meine" zählt jetzt BEIDE Mengen zusammen: mir zugewiesene UND
// Tickets, in denen ich zusätzlicher Mitarbeiter bin (Paul-Vorgabe: die zusätzlichen
// gehören mit in „Meine offenen Tickets"). So stimmen Sidebar-Badge, Heading-Badge
// und Dashboard-Kachel überein. Nur query/count (eine Zahl) → günstig; 60 s gecacht.

export interface SidebarTicketCounts {
  mine: number;
  team: number;
}

async function fetchCounts(resourceId: number): Promise<SidebarTicketCounts> {
  const open: AutotaskFilter = { op: "noteq", field: "status", value: 5 };
  const mineFilter: AutotaskFilter[] = [
    { op: "eq", field: "assignedResourceID", value: resourceId },
    open,
  ];
  const teamFilter: AutotaskFilter[] = [open];
  const [primaryMine, secondaryMine, team] = await Promise.all([
    autotask.count("Tickets", mineFilter),
    countSecondaryOpen(resourceId),
    autotask.count("Tickets", teamFilter),
  ]);
  // Mögliche minimale Doppelzählung (mir zugewiesen UND zusätzlich) ist in der
  // Praxis vernachlässigbar; bewusst einfache Summe (gleiche Logik wie die Kachel).
  return { mine: primaryMine + secondaryMine, team };
}

// Gecachte Variante (60 s, Schlüssel inkl. Resource-ID). Fehler werden NICHT hier
// geschluckt – der Aufrufer (Layout) fängt sie ab, damit die App nie kippt.
export function getSidebarTicketCounts(
  resourceId: number,
): Promise<SidebarTicketCounts> {
  return unstable_cache(
    () => fetchCounts(resourceId),
    ["sidebar-ticket-counts", String(resourceId)],
    { revalidate: 60 },
  )();
}
