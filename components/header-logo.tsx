"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import autotaskLogo from "../public/autotask-logo.png";

// Logo oben links im App-Header – nur mobil (Desktop hat es in der Sidebar).
// Auf Detailseiten (Ticket/Firma/Projekt) sitzt links der Zurück-Button allein, daher
// dort kein Logo (gleiche Routen-Regel wie header-back.tsx).
const DETAIL_ROUTES = [
  /^\/tickets\/\d+$/,
  /^\/companies\/\d+$/,
  /^\/projekte\/\d+$/,
];

export function HeaderLogo() {
  const pathname = usePathname();
  if (DETAIL_ROUTES.some((re) => re.test(pathname))) return null;

  return (
    <Link
      href="/"
      aria-label="Übersicht"
      className="-ml-1 flex size-11 items-center justify-center md:hidden"
    >
      <Image
        src={autotaskLogo}
        alt="Autotask"
        width={24}
        height={24}
        priority
        className="size-6 shrink-0 rounded-sm"
      />
    </Link>
  );
}
