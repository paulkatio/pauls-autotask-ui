"use client";

import * as React from "react";
import {
  Buildings,
  Envelope,
  Phone,
  DeviceMobile,
} from "@phosphor-icons/react/ssr";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { subscribeOpenContact } from "@/lib/open-contact";
import { useRecordNav } from "@/hooks/use-record-nav";

interface ContactDetail {
  id: number;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobilePhone: string | null;
  companyID: number | null;
  companyName: string | null;
}

// Kompaktes Kontakt-Overlay im gleichen Fenster (Paul: Kontakt = kleines Pop-up
// INNERHALB des Fensters, NICHT als eigenes Browser-Fenster wie Ticket/Firma).
// Genau einmal im Layout gemountet; hört auf openContactModal(id) und lädt nach.
export function ContactModal() {
  const { openCompany } = useRecordNav();
  const [id, setId] = React.useState<number | null>(null);
  const [data, setData] = React.useState<ContactDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => subscribeOpenContact((next) => setId(next)), []);

  /* eslint-disable react-hooks/set-state-in-effect -- bewusster, korrekter Effekt
     (Daten-Load bei ID-Wechsel): synchrones Zurücksetzen vor dem Fetch ist gewollt. */
  React.useEffect(() => {
    if (id == null) return;
    let active = true;
    setData(null);
    setError(null);
    fetch(`/api/contacts/${id}`, { cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as {
          contact?: ContactDetail;
          error?: string;
        };
        if (!r.ok) {
          throw new Error(j.error ?? "Kontakt konnte nicht geladen werden.");
        }
        return j.contact ?? null;
      })
      .then((c) => {
        if (active) setData(c);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Fehler.");
      });
    return () => {
      active = false;
    };
  }, [id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const hasContactData = !!(data && (data.email || data.phone || data.mobilePhone));

  return (
    <Dialog
      open={id != null}
      onOpenChange={(o) => {
        if (!o) setId(null);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="truncate">
            {data?.name ?? "Kontakt"}
          </DialogTitle>
          <DialogDescription>{data?.title || "Kontaktdetails"}</DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="text-destructive text-sm">{error}</p>
        ) : !data ? (
          <div className="flex flex-col gap-3 py-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-7 w-40" />
          </div>
        ) : (
          <div className="flex flex-col gap-2 py-1 text-sm">
            {data.companyID != null ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start font-normal"
                onClick={() => {
                  if (data.companyID == null) return;
                  const cid = data.companyID;
                  // Overlay schließen, bevor in-App zur Firma navigiert wird
                  // (im Desktop-Popup-Fall öffnet sich ohnehin ein neues Fenster).
                  setId(null);
                  openCompany(cid);
                }}
              >
                <Buildings className="text-muted-foreground" />
                <span className="truncate">
                  {data.companyName ?? `Firma ${data.companyID}`}
                </span>
              </Button>
            ) : null}
            {data.email ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start font-normal"
                render={<a href={`mailto:${data.email}`} aria-label={`E-Mail an ${data.email}`} />}
              >
                <Envelope className="text-muted-foreground" />
                <span className="truncate">{data.email}</span>
              </Button>
            ) : null}
            {data.phone ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start font-normal"
                render={<a href={`tel:${data.phone}`} aria-label={`${data.phone} anrufen`} />}
              >
                <Phone className="text-muted-foreground" />
                <span className="tabular-nums">{data.phone}</span>
              </Button>
            ) : null}
            {data.mobilePhone ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start font-normal"
                render={<a href={`tel:${data.mobilePhone}`} aria-label={`${data.mobilePhone} anrufen`} />}
              >
                <DeviceMobile className="text-muted-foreground" />
                <span className="tabular-nums">{data.mobilePhone}</span>
              </Button>
            ) : null}
            {!hasContactData && data.companyID == null ? (
              <p className="text-muted-foreground">Keine Kontaktdaten hinterlegt.</p>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
