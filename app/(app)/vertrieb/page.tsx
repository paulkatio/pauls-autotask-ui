import { notFound, redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import { canAccessSales } from "@/lib/auth/sales-access";

// Landing -> Rechnungen (primärer Reiter, vom Chef gewünscht). Gate auch hier.
export default async function VertriebPage() {
  const session = await getSession();
  if (!session) return null;
  if (!canAccessSales(session)) notFound();
  redirect("/vertrieb/rechnungen");
}
