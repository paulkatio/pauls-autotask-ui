import * as React from "react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";

// Gemeinsame, read-only Detail-Bausteine für den Vertriebsbereich.

export function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="grid grid-cols-1 gap-x-6 gap-y-4 py-6 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </CardContent>
    </Card>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm break-words">{children}</span>
    </div>
  );
}

export interface PositionRow {
  id: number;
  name: string;
  description: string | null;
  quantity: number | null;
  unitPrice: number | null;
  total: number | null;
}

function qty(n: number | null): string {
  return n != null ? n.toLocaleString("de-DE") : "—";
}

// Positions-/Zeilentabelle fürs Rechnungs-/Angebotsdetail (read-only). Desktop =
// Tabelle, Mobile = gestapelte Karten. Optionaler Summenfuß (sumLabel + sum).
export function PositionsTable({
  rows,
  sum,
  sumLabel = "Summe",
}: {
  rows: PositionRow[];
  sum?: number | null;
  sumLabel?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Keine Positionen vorhanden.</p>
    );
  }

  return (
    <>
      {/* Mobile: Karten */}
      <div className="flex flex-col gap-2 sm:hidden">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-col gap-1 rounded-lg border p-3">
            <span className="text-sm font-medium break-words">{r.name}</span>
            {r.description && (
              <span className="text-muted-foreground line-clamp-3 text-xs break-words">
                {r.description}
              </span>
            )}
            <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs tabular-nums">
              <span>
                {qty(r.quantity)} × {formatCurrency(r.unitPrice)}
              </span>
              <span className="text-foreground font-medium">
                {formatCurrency(r.total)}
              </span>
            </div>
          </div>
        ))}
        {sum != null && (
          <div className="flex items-center justify-between gap-2 px-1 text-sm font-medium tabular-nums">
            <span>{sumLabel}</span>
            <span>{formatCurrency(sum)}</span>
          </div>
        )}
      </div>

      {/* Desktop: Tabelle. Beschreibung umbricht (gedeckelt), die Zahlenspalten
          schrumpfen auf Inhaltsbreite (w-px) und bleiben sichtbar – kein Wegscrollen. */}
      <div className="hidden overflow-x-auto rounded-lg border sm:block">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Beschreibung</TableHead>
              <TableHead className="w-px text-right whitespace-nowrap">Menge</TableHead>
              <TableHead className="w-px text-right whitespace-nowrap">Einzelpreis</TableHead>
              <TableHead className="w-px text-right whitespace-nowrap">Summe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="max-w-0">
                  <div className="flex flex-col">
                    <span className="font-medium break-words">{r.name}</span>
                    {r.description && (
                      <span className="text-muted-foreground line-clamp-2 text-xs break-words">
                        {r.description}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="w-px text-right tabular-nums whitespace-nowrap">
                  {qty(r.quantity)}
                </TableCell>
                <TableCell className="w-px text-right tabular-nums whitespace-nowrap">
                  {formatCurrency(r.unitPrice)}
                </TableCell>
                <TableCell className="w-px text-right font-medium tabular-nums whitespace-nowrap">
                  {formatCurrency(r.total)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {sum != null && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="text-right font-medium">
                  {sumLabel}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums whitespace-nowrap">
                  {formatCurrency(sum)}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </>
  );
}
