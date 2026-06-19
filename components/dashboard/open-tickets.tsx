"use client";

import * as React from "react";
import Link from "next/link";

import { TicketsList, type TicketRow } from "@/components/tickets/tickets-list";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { TicketPicklists } from "@/lib/autotask/types";
import type { ResourceOption } from "@/lib/autotask/entities/resources";

type Page = {
  items: TicketRow[];
  nextCursor: string | null;
  prevCursor: string | null;
};

type Assigned = "all" | "unassigned";

// „Offene Tickets" auf der Übersicht: Schnellfilter (Alle / nur nicht zugewiesene)
// und Paging laufen CLIENTSEITIG über /api/tickets/open – KEINE URL-Änderung, damit
// die Seite nicht neu lädt (kein loading.tsx-Skelett) und nicht nach oben springt.
// Darstellung über die gemeinsame TicketsList (Karten mobil, Tabelle ab xl).
export function OpenTickets({
  picklists,
  initial,
  count,
  resources,
  myResourceId,
}: {
  picklists: TicketPicklists;
  initial: Page;
  // Gesamtzahl offener Tickets (team-weit) für den Badge neben der Überschrift.
  count?: number;
  // Mehrfachauswahl + Bulk-Aktionen wie in „Meine Tickets"/„Teamtickets". Ohne
  // diese beiden bleibt die Liste read-only (z. B. wenn die Resourcen nicht
  // geladen werden konnten).
  resources?: ResourceOption[];
  myResourceId?: number;
}) {
  const [assigned, setAssigned] = React.useState<Assigned>("all");
  const [data, setData] = React.useState<Page>(initial);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchPage = React.useCallback(
    async (a: Assigned, cursor?: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (a === "unassigned") params.set("assigned", "unassigned");
        if (cursor) params.set("cursor", cursor);
        const res = await fetch(`/api/tickets/open?${params.toString()}`, {
          cache: "no-store",
        });
        const j = (await res.json().catch(() => ({}))) as Partial<Page> & {
          error?: string;
        };
        if (!res.ok) throw new Error(j.error ?? "Tickets konnten nicht geladen werden.");
        setData({
          items: j.items ?? [],
          nextCursor: j.nextCursor ?? null,
          prevCursor: j.prevCursor ?? null,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Tickets konnten nicht geladen werden.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  function selectAssigned(a: Assigned) {
    if (a === assigned) return;
    setAssigned(a);
    fetchPage(a); // Filterwechsel → zurück auf die erste Seite.
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            Offene Tickets
            {count != null && count > 0 && (
              <Badge
                variant="secondary"
                className="bg-chart-2/15 text-chart-2 tabular-nums"
              >
                {count > 999 ? "999+" : count}
              </Badge>
            )}
          </h2>
          {/* Segmentiert über die gemeinsame Tabs-Komponente (gleiches Muster wie
              vertrieb-tabs/url-tabs) – klarer Aktiv-Zustand in Hell UND Dunkel.
              Auswahl-Logik unverändert (selectAssigned). */}
          <Tabs
            value={assigned}
            onValueChange={(v) => selectAssigned(v as Assigned)}
          >
            <TabsList className="group-data-horizontal/tabs:h-auto">
              <TabsTrigger
                value="all"
                className="h-11 sm:h-9"
                disabled={loading}
              >
                Alle offenen
              </TabsTrigger>
              <TabsTrigger
                value="unassigned"
                className="h-11 sm:h-9"
                disabled={loading}
              >
                Nur nicht zugewiesene
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Gleiche Darstellung wie „Teamtickets": Karten mobil, volle Tabelle ab xl.
            bordered={false}: der eigene Rahmen entfällt, da die Liste bereits in
            dieser Karte sitzt (kein Karte-in-Karte). */}
        <div
          className={cn(
            "transition-opacity",
            loading && "pointer-events-none opacity-60",
          )}
        >
          <TicketsList
            data={data}
            picklists={picklists}
            filters={{ status: "open", priority: "", queue: "", assigned }}
            columns={{ assigned: true }}
            showFilters={false}
            showPager={false}
            mobileLimit={8}
            mobileOverflowHint={false}
            searchMode="off"
            bordered={false}
            compact
            selectable
            resources={resources}
            myResourceId={myResourceId}
            // Clientseitige Liste: nach einer Bulk-Aktion die aktuelle Seite neu
            // laden (statt router.refresh -> kein voller Seiten-Neuaufbau).
            onBulkApplied={() => fetchPage(assigned)}
            emptyDescription={
              assigned === "unassigned"
                ? "Keine nicht zugewiesenen offenen Tickets."
                : "Keine offenen Tickets."
            }
          />
        </div>

        {/* Übersicht zeigt nur die erste Seite; statt Pager ein einzelner Sprung in
            die volle Liste (respektiert den aktiven „nicht zugewiesen"-Filter).
            Mittig (Desktop) statt rechtsbündig; Anzahl direkt im Button. */}
        <Button
          variant="outline"
          nativeButton={false}
          className="h-11 w-full sm:h-9 sm:w-auto sm:self-center"
          render={
            <Link
              href={
                assigned === "unassigned"
                  ? "/tickets/team?assigned=unassigned"
                  : "/tickets/team"
              }
            />
          }
        >
          {assigned === "unassigned"
            ? "Alle nicht zugewiesenen anzeigen"
            : count != null
              ? `Alle ${count} offenen Tickets anzeigen`
              : "Alle offenen Tickets anzeigen"}
        </Button>
      </CardContent>
    </Card>
  );
}
