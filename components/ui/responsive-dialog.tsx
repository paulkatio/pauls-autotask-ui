"use client";

import * as React from "react";

import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// Responsive Dialog ↔ Bottom-Sheet. Mobil (useIsMobile) rendert ein von unten
// einfahrendes Sheet (gut mit dem Daumen erreichbar), sonst den zentrierten Dialog.
// Beide basieren auf demselben @base-ui/react/dialog → identische Root-API
// (open/onOpenChange), daher 1:1 umschaltbar. KEIN externes Paket (kein vaul).
//
// Aufbau für lange Formulare: fixer Header, scrollender Body (ResponsiveDialogBody),
// Footer mit Aktionen. Mobil deckelt der Body über max-h des Sheets, der Body nimmt
// per flex-1 den Rest und scrollt; der Footer bleibt sichtbar.

const ResponsiveCtx = React.createContext(false);
const useResponsive = () => React.useContext(ResponsiveCtx);

function ResponsiveDialog(props: React.ComponentProps<typeof Dialog>) {
  const isMobile = useIsMobile();
  const Root = isMobile ? Sheet : Dialog;
  return (
    <ResponsiveCtx.Provider value={isMobile}>
      <Root {...props} />
    </ResponsiveCtx.Provider>
  );
}

function ResponsiveDialogTrigger(
  props: React.ComponentProps<typeof DialogTrigger>,
) {
  const isMobile = useResponsive();
  const Trigger = isMobile ? SheetTrigger : DialogTrigger;
  return <Trigger {...props} />;
}

function ResponsiveDialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  const isMobile = useResponsive();
  if (isMobile) {
    return (
      <SheetContent
        side="bottom"
        className={cn("max-h-[90dvh] gap-0", className)}
        {...props}
      >
        {children}
      </SheetContent>
    );
  }
  return (
    // Desktop: NUR der Body (ResponsiveDialogBody) scrollt. Das Popup selbst darf
    // nicht vertikal scrollen – sonst erzeugt der bündige Footer (negatives -mb-4,
    // das in das p-4 des Popups ragt, weil der Footer hier im <form> steckt statt
    // direktes Popup-Kind zu sein) einen dauerhaften ~1rem-Scrollbalken, unabhängig
    // von Inhalt und Zoom.
    <DialogContent className={cn("pb-0", className)} {...props}>
      {children}
    </DialogContent>
  );
}

function ResponsiveDialogHeader(props: React.ComponentProps<"div">) {
  const isMobile = useResponsive();
  return isMobile ? <SheetHeader {...props} /> : <DialogHeader {...props} />;
}

function ResponsiveDialogFooter(props: React.ComponentProps<"div">) {
  const isMobile = useResponsive();
  // Mobil unten safe-area-sicher absetzen; Desktop nutzt den Dialog-Footer
  // (randbündig mit Trennlinie).
  return isMobile ? (
    <SheetFooter
      {...props}
      className={cn(
        "pb-[calc(1rem+env(safe-area-inset-bottom))]",
        props.className,
      )}
    />
  ) : (
    // Desktop: das negative -mb-4 des DialogFooter würde hier aus dem <form>
    // herauslecken (Footer ist NICHT direktes Popup-Kind) und dem scrollenden Body
    // ein paar Pixel klauen → Dauer-Scrollbalken. Stattdessen Footer bündig über
    // pb-0 am Popup + mb-0 am Footer (kein Leck).
    <DialogFooter {...props} className={cn("mb-0", props.className)} />
  );
}

function ResponsiveDialogTitle(
  props: React.ComponentProps<typeof DialogTitle>,
) {
  const isMobile = useResponsive();
  return isMobile ? <SheetTitle {...props} /> : <DialogTitle {...props} />;
}

function ResponsiveDialogDescription(
  props: React.ComponentProps<typeof DialogDescription>,
) {
  const isMobile = useResponsive();
  return isMobile ? (
    <SheetDescription {...props} />
  ) : (
    <DialogDescription {...props} />
  );
}

function ResponsiveDialogClose(props: React.ComponentProps<typeof DialogClose>) {
  const isMobile = useResponsive();
  return isMobile ? <SheetClose {...props} /> : <DialogClose {...props} />;
}

// Scrollender Inhaltsbereich zwischen Header und Footer. Mobil: flex-1 + min-h-0,
// damit er den Rest des gedeckelten Sheets einnimmt und scrollt. Desktop: der Body
// darf bis fast zur Fensterhöhe wachsen (Popup-Cap 90dvh minus Kopf/Fuß ≈ 10rem),
// damit der Dialog auf großen Schirmen so groß wie nötig ist und NICHT schon bei
// 60dvh ein paar überflüssige Pixel scrollt – er scrollt erst, wenn er sonst über
// den Viewport hinausliefe.
function ResponsiveDialogBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const isMobile = useResponsive();
  return (
    <div
      className={cn(
        "overscroll-contain",
        // Mobil: eigener Scrollbereich (Sheet ist fix gedeckelt). Desktop: KEIN
        // eigener Scroller – das Popup selbst scrollt (inhaltsgroß, gedeckelt bei
        // 90dvh). So kein verschachtelter Flex-Scroller, der dem Body Pixel klaut.
        isMobile ? "min-h-0 flex-1 overflow-y-auto px-4" : "px-1 pb-4",
        className,
      )}
      {...props}
    />
  );
}

export {
  ResponsiveDialog,
  ResponsiveDialogTrigger,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogClose,
  ResponsiveDialogBody,
};
