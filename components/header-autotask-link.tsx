"use client";

import { usePathname } from "next/navigation";

import { AutotaskOpenButton } from "@/components/autotask-open-button";
import {
  ticketUrlFrom,
  companyUrlFrom,
  projectUrlFrom,
} from "@/lib/autotask/links-format";

// Mobiler „In Autotask öffnen"-Link in der App-Kopfzeile (md:hidden), rechts wo
// sonst der Sidebar-Trigger saß – die Sidebar ist über den „Mehr"-Tab der
// Bottom-Nav erreichbar. Erscheint NUR auf Ticket-/Firmen-Detailrouten. Die
// Web-Basis kommt serverseitig aus dem Layout (process.env), als Prop hereingereicht.
export function HeaderAutotaskLink({ webBase }: { webBase: string | null }) {
  const pathname = usePathname();

  const ticketMatch = pathname.match(/^\/tickets\/(\d+)/);
  const companyMatch = pathname.match(/^\/companies\/(\d+)/);
  const projectMatch = pathname.match(/^\/projekte\/(\d+)/);

  // projectUrlFrom liefert vorerst null (Autotask-Projekt-Deeplink noch unbestätigt)
  // → der Knopf erscheint auf Projektseiten erst, wenn der Pfad eingetragen ist.
  const href = ticketMatch
    ? ticketUrlFrom(webBase, Number(ticketMatch[1]))
    : companyMatch
      ? companyUrlFrom(webBase, Number(companyMatch[1]))
      : projectMatch
        ? projectUrlFrom(webBase, Number(projectMatch[1]))
        : null;

  if (!href) return null;

  // Schmaler Knopf mit Logo + „Autotask" + Link-Icon (wie Desktop), nur etwas
  // höher für die Touch-Bedienung. Nur Mobile (md:hidden).
  return (
    <AutotaskOpenButton href={href} label="Autotask" className="h-9 md:hidden" />
  );
}
