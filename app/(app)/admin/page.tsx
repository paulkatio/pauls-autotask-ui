import { GearSix } from "@phosphor-icons/react/ssr";

import { PageHeader } from "@/components/page-header";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function AdminPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Admin" description="Verwaltung und Einstellungen." />
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <GearSix />
          </EmptyMedia>
          <EmptyTitle>Noch keine Admin-Funktionen</EmptyTitle>
          <EmptyDescription>
            Dieser Bereich wird in einem späteren Schritt ausgebaut.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}
