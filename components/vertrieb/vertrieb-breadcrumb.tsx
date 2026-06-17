import Link from "next/link";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

// Detail-Orientierung im Vertriebsbereich: gedämpfter Pfad „Liste › Aktuelles".
// Ersetzt den früheren Zurück-Link + Tab-Streifen (kein dreifaches „Rechnungen").
// Der Listen-Eintrag ist die Zurück-Navigation; der große Titel steht im PageHeader.
export function VertriebBreadcrumb({
  listHref,
  listLabel,
  current,
}: {
  listHref: string;
  listLabel: string;
  current: string;
}) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href={listHref} />}>
            {listLabel}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{current}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
