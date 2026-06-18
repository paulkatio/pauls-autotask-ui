"use client";

import * as React from "react";
import { NotePencil } from "@phosphor-icons/react/ssr";

import { Button } from "@/components/ui/button";
import { NoteForm } from "@/components/tickets/note-form";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";

// „Neue Notiz" als eigene Aktion neben „Zeit erfassen". Öffnet das Notizformular im
// Dialog/Bottom-Sheet – unabhängig vom (standardmäßig eingeklappten) Aktivität-Bereich.
export function NewNoteButton({
  ticketId,
  className,
}: {
  ticketId: number;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger
        render={
          <Button
            variant="outline"
            className={cn("h-11 flex-1 sm:h-9 sm:flex-none", className)}
          />
        }
      >
        <NotePencil />
        Neue Notiz
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="flex flex-col">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Neue interne Notiz</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Nur intern – für den Kunden nicht sichtbar.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody className="py-1">
          <NoteForm ticketId={ticketId} onClose={() => setOpen(false)} />
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
