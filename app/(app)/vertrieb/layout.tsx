import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth";
import { canAccessSales } from "@/lib/auth/sales-access";
import { VertriebTabs } from "@/components/vertrieb/vertrieb-tabs";

// Zugriffs-Gate für den gesamten Vertriebsbereich (Listen UND Details an EINER
// Stelle). Nicht berechtigt -> notFound() (404, diskret – verrät den Bereich nicht;
// /no-access ist fachlich „Entra ohne Resource"). Siehe lib/auth/sales-access.
// Die Unterreiter (VertriebTabs) sitzen JETZT in diesem Layout (nicht mehr in den
// Seiten): so bleibt die Tab-Leiste beim Wechsel Rechnungen/Verträge/Angebote stehen
// (kein Remount/Flackern), nur der Inhalt darunter lädt neu. Die Leiste blendet sich
// auf Detailseiten selbst aus (dort führt ein Breadcrumb).
export default async function VertriebLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession();
  if (!canAccessSales(session)) notFound();

  return (
    <div className="flex flex-col gap-6">
      <VertriebTabs />
      {children}
    </div>
  );
}
