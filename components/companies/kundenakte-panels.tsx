"use client";

import { FileText, Monitor, Users } from "@phosphor-icons/react/ssr";

import { Badge } from "@/components/ui/badge";
import { contractStatusLabel, contractStatusVariant } from "@/lib/autotask/mappers";
import { SearchableTable } from "@/components/searchable-table";
import { TruncatedText } from "@/components/truncated-text";
import { openContactModal } from "@/lib/open-contact";
import type { ContactRow } from "@/lib/autotask/entities/contacts";
import type { DeviceRow } from "@/lib/autotask/entities/config-items";
import type { ContractRow } from "@/lib/autotask/entities/contracts";

// Kundenakte-Tabs als durchsuchbare Tabellen (Paul-Feedback: jede Liste braucht
// eine Suche). Daten sind vollständig geladen → Filter rein clientseitig.

function fmtDay(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function daySort(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

export function ContactsPanel({ rows }: { rows: ContactRow[] }) {
  return (
    <SearchableTable
      rows={rows}
      storageKey="cols:kundenakte-kontakte"
      searchText={(r) => `${r.name} ${r.email} ${r.phone}`}
      searchPlaceholder="Kontakt suchen …"
      onRowClick={(r) => openContactModal(r.id)}
      emptyIcon={<Users />}
      emptyTitle="Keine Kontakte"
      emptyDescription="Für diese Firma sind keine aktiven Kontakte hinterlegt."
      columns={[
        {
          key: "name",
          header: "Name",
          sortValue: (r) => r.name ?? "",
          cell: (r) => (
            <TruncatedText className="max-w-xs font-medium">
              {r.name}
            </TruncatedText>
          ),
        },
        {
          key: "email",
          header: "E-Mail",
          sortValue: (r) => r.email ?? "",
          cell: (r) => (
            <TruncatedText className="text-muted-foreground max-w-xs">
              {r.email || "—"}
            </TruncatedText>
          ),
        },
        {
          key: "phone",
          header: "Telefon",
          sortValue: (r) => r.phone ?? "",
          cell: (r) => r.phone || "—",
          cellClassName:
            "text-muted-foreground tabular-nums whitespace-nowrap",
        },
      ]}
    />
  );
}

export function DevicesPanel({ rows }: { rows: DeviceRow[] }) {
  return (
    <SearchableTable
      rows={rows}
      storageKey="cols:kundenakte-geraete"
      searchText={(r) => `${r.name} ${r.serialNumber} ${r.location}`}
      searchPlaceholder="Gerät suchen …"
      emptyIcon={<Monitor />}
      emptyTitle="Keine Geräte"
      emptyDescription="Für diese Firma sind keine Geräte erfasst."
      columns={[
        {
          key: "name",
          header: "Name",
          sortValue: (r) => r.name ?? "",
          cell: (r) => (
            <TruncatedText className="max-w-xs font-medium">
              {r.name}
            </TruncatedText>
          ),
        },
        {
          key: "serial",
          header: "Seriennummer",
          sortValue: (r) => r.serialNumber ?? "",
          cell: (r) => (
            <TruncatedText className="text-muted-foreground max-w-44">
              {r.serialNumber || "—"}
            </TruncatedText>
          ),
        },
        {
          key: "location",
          header: "Standort",
          sortValue: (r) => r.location ?? "",
          cell: (r) => (
            <TruncatedText className="text-muted-foreground max-w-44">
              {r.location || "—"}
            </TruncatedText>
          ),
        },
      ]}
    />
  );
}

export function ContractsPanel({ rows }: { rows: ContractRow[] }) {
  return (
    <SearchableTable
      rows={rows}
      storageKey="cols:kundenakte-vertraege"
      searchText={(r) => r.name}
      searchPlaceholder="Vertrag suchen …"
      emptyIcon={<FileText />}
      emptyTitle="Keine Verträge"
      emptyDescription="Für diese Firma sind keine Verträge hinterlegt."
      columns={[
        {
          key: "name",
          header: "Name",
          sortValue: (r) => r.name ?? "",
          cell: (r) => (
            <TruncatedText className="max-w-xs font-medium">
              {r.name}
            </TruncatedText>
          ),
        },
        {
          key: "period",
          header: "Zeitraum",
          sortValue: (r) => daySort(r.startDate),
          cell: (r) => `${fmtDay(r.startDate)} – ${fmtDay(r.endDate)}`,
          cellClassName:
            "text-muted-foreground tabular-nums whitespace-nowrap",
        },
        {
          key: "status",
          header: "Status",
          sortValue: (r) => r.status ?? null,
          cell: (r) =>
            r.status === 1 || r.status === 0 ? (
              <Badge variant={contractStatusVariant(r.status)}>
                {contractStatusLabel(r.status)}
              </Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        },
      ]}
    />
  );
}
