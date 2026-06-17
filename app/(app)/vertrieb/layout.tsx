import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth";
import { canAccessSales } from "@/lib/auth/sales-access";

// Zugriffs-Gate für den gesamten Vertriebsbereich (Listen UND Details an EINER
// Stelle). Nicht berechtigt -> notFound() (404, diskret – verrät den Bereich nicht;
// /no-access ist fachlich „Entra ohne Resource"). Siehe lib/auth/sales-access.
// Die Unterreiter (VertriebTabs) sitzen auf den LISTEN-Seiten; Detailseiten nutzen
// stattdessen einen Breadcrumb (klare Hierarchie statt doppelter „Rechnungen").
export default async function VertriebLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession();
  if (!canAccessSales(session)) notFound();

  return children;
}
