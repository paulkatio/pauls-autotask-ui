import "server-only";

import { autotask } from "@/lib/autotask/client";

// Angebotspositionen = Autotask `QuoteItems` gefiltert nach quoteID
// (verifiziert 2026-06-17, Sandbox).
interface QuoteItem {
  id: number;
  quoteID?: number | null;
  name?: string | null;
  description?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
}

export interface QuoteLineRow {
  id: number;
  name: string;
  description: string | null;
  quantity: number | null;
  unitPrice: number | null;
  total: number | null; // quantity × unitPrice (Rabatte/Steuer NICHT eingerechnet)
}

export const quoteItems = {
  // Positionen EINES Angebots inkl. summiertem Betrag. Zeilensumme = Menge × Einzelpreis
  // (Rabatte/Steuer bewusst nicht eingerechnet – dokumentierte Lese-Vereinfachung).
  async byQuote(
    quoteId: number,
  ): Promise<{ rows: QuoteLineRow[]; total: number }> {
    const raw = await autotask.query<QuoteItem>("QuoteItems", {
      MaxRecords: 500,
      IncludeFields: [
        "id",
        "quoteID",
        "name",
        "description",
        "quantity",
        "unitPrice",
      ],
      Filter: [{ op: "eq", field: "quoteID", value: quoteId }],
    });

    let total = 0;
    const rows: QuoteLineRow[] = raw.map((q) => {
      const qty = q.quantity ?? null;
      const price = q.unitPrice ?? null;
      const line = qty != null && price != null ? qty * price : null;
      if (line != null) total += line;
      return {
        id: q.id,
        name: q.name ?? "—",
        description: q.description ?? null,
        quantity: qty,
        unitPrice: price,
        total: line,
      };
    });

    return { rows, total };
  },
};
