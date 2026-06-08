"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Building2Icon,
  ClockIcon,
  ContactIcon,
  HashIcon,
  LayoutDashboardIcon,
  SearchIcon,
  SettingsIcon,
  TicketIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ResultColumn,
  ResultGrid,
  type SearchResultItem,
} from "@/components/search/result-column";
import { openContactModal } from "@/lib/open-contact";

// Event-Name, mit dem die Header-Suche die Palette öffnet.
export const OPEN_COMMAND_PALETTE = "open-command-palette";

const COLUMN_LIMIT = 8;

interface NavTarget {
  title: string;
  url: string;
  icon: LucideIcon;
}

const NAV: NavTarget[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboardIcon },
  { title: "Meine Tickets", url: "/tickets/my", icon: TicketIcon },
  { title: "Teamtickets", url: "/tickets/team", icon: UsersIcon },
  { title: "Firmen", url: "/companies", icon: Building2Icon },
  { title: "Kontakte", url: "/contacts", icon: ContactIcon },
  { title: "Meine Zeiten", url: "/zeiten", icon: ClockIcon },
  { title: "Admin", url: "/admin", icon: SettingsIcon },
];

interface TicketHit {
  id: number;
  ticketNumber: string | null;
  title: string | null;
}
interface CompanyHit {
  id: number;
  name: string;
}
interface ContactHit {
  id: number;
  name: string;
  companyName: string | null;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [ticketName, setTicketName] = React.useState<TicketHit[]>([]);
  const [ticketNumber, setTicketNumber] = React.useState<TicketHit[]>([]);
  const [companies, setCompanies] = React.useState<CompanyHit[]>([]);
  const [contacts, setContacts] = React.useState<ContactHit[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Cmd/Ctrl+K togglet die Palette; ein Custom-Event öffnet sie (Header-Suche).
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    document.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_COMMAND_PALETTE, onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_COMMAND_PALETTE, onOpen);
    };
  }, []);

  React.useEffect(() => {
    if (open) {
      // Fokus sicher auf das große Suchfeld setzen.
      const id = window.setTimeout(() => inputRef.current?.focus(), 20);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  function clearHits() {
    setTicketName([]);
    setTicketNumber([]);
    setCompanies([]);
    setContacts([]);
  }

  // Vier parallele, begrenzte, debounced Abfragen: Ticket-Name / Ticket-Nummer /
  // Firma / Kontakt. Tickets gehen als 2 Abfragen auf dieselbe Tabelle – der
  // Client-Limiter (max. 2/Entität) hält das Autotask-Thread-Limit ein.
  React.useEffect(() => {
    const q = query.trim();
    if (!q) {
      clearHits();
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const enc = encodeURIComponent(q);
      const json = (url: string) =>
        fetch(url, { cache: "no-store" })
          .then((r) => r.json())
          .catch(() => ({}));
      try {
        const [tn, tnr, co, ct] = await Promise.all([
          json(`/api/tickets/search?scope=name&q=${enc}`) as Promise<{
            items?: TicketHit[];
          }>,
          json(`/api/tickets/search?scope=number&q=${enc}`) as Promise<{
            items?: TicketHit[];
          }>,
          json(`/api/companies?q=${enc}`) as Promise<{
            companies?: CompanyHit[];
          }>,
          json(`/api/contacts/search?q=${enc}`) as Promise<{
            contacts?: ContactHit[];
          }>,
        ]);
        if (!active) return;
        setTicketName((tn.items ?? []).slice(0, COLUMN_LIMIT));
        setTicketNumber((tnr.items ?? []).slice(0, COLUMN_LIMIT));
        setCompanies((co.companies ?? []).slice(0, COLUMN_LIMIT));
        setContacts((ct.contacts ?? []).slice(0, COLUMN_LIMIT));
      } catch {
        if (active) clearHits();
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query]);

  function go(url: string) {
    setOpen(false);
    setQuery("");
    clearHits();
    router.push(url);
  }

  // Kontakt: Palette schließen und das In-App-Overlay öffnen (kein Seitenwechsel).
  function selectContact(href: string) {
    const id = Number(href.split("/").pop());
    setOpen(false);
    setQuery("");
    clearHits();
    if (Number.isFinite(id)) openContactModal(id);
  }

  const hasQuery = query.trim().length > 0;
  const navFiltered = hasQuery
    ? NAV.filter((n) => n.title.toLowerCase().includes(query.trim().toLowerCase()))
    : NAV;

  const ticketNameItems: SearchResultItem[] =ticketName.map((t) => ({
    key: `tn-${t.id}`,
    href: `/tickets/${t.id}`,
    primary: t.title ?? t.ticketNumber ?? `Ticket ${t.id}`,
    secondary: t.ticketNumber,
  }));
  const ticketNumberItems: SearchResultItem[] =ticketNumber.map((t) => ({
    key: `tnr-${t.id}`,
    href: `/tickets/${t.id}`,
    primary: t.ticketNumber ?? `Ticket ${t.id}`,
    secondary: t.title,
  }));
  const companyItems: SearchResultItem[] =companies.map((c) => ({
    key: `co-${c.id}`,
    href: `/companies/${c.id}`,
    primary: c.name,
  }));
  const contactItems: SearchResultItem[] =contacts.map((c) => ({
    key: `ct-${c.id}`,
    href: `/contacts/${c.id}`,
    primary: c.name,
    secondary: c.companyName,
  }));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="top-1/4 w-full translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-2xl lg:max-w-4xl xl:max-w-6xl"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Suche</DialogTitle>
          <DialogDescription>
            Tickets, Firmen und Kontakte gleichzeitig durchsuchen
          </DialogDescription>
        </DialogHeader>

        {/* Große Suchleiste (Spotlight-Stil). */}
        <div className="flex items-center gap-3 border-b px-4">
          <SearchIcon className="text-muted-foreground size-5 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && hasQuery) {
                go(`/search?q=${encodeURIComponent(query.trim())}`);
              }
            }}
            placeholder="Suchen … Tickets, Firmen, Kontakte"
            aria-label="Suche"
            className="placeholder:text-muted-foreground h-14 w-full bg-transparent text-base outline-none"
          />
        </div>

        {!hasQuery ? (
          // „Springen zu"-Vorschläge nur ab sm; auf Mobile bleibt bei leerer
          // Suche nur die Suchleiste (Paul-Feedback).
          <div className="hidden p-2 sm:block">
            <p className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
              Springen zu
            </p>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {navFiltered.map((n) => (
                <button
                  key={n.url}
                  type="button"
                  onClick={() => go(n.url)}
                  className="hover:bg-muted flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <n.icon className="text-muted-foreground size-4 shrink-0" />
                  {n.title}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ResultGrid dense>
            <ResultColumn
              title="Firma"
              icon={<Building2Icon className="size-3.5 shrink-0" />}
              items={companyItems}
              loading={loading}
              onSelect={go}
              className="bg-popover"
            />
            <ResultColumn
              title="Kontakte"
              icon={<ContactIcon className="size-3.5 shrink-0" />}
              items={contactItems}
              loading={loading}
              onSelect={selectContact}
              className="bg-popover"
            />
            <ResultColumn
              title="Ticket-Name"
              icon={<TicketIcon className="size-3.5 shrink-0" />}
              items={ticketNameItems}
              loading={loading}
              onSelect={go}
              className="bg-popover"
            />
            <ResultColumn
              title="Ticket-Nummer"
              icon={<HashIcon className="size-3.5 shrink-0" />}
              items={ticketNumberItems}
              loading={loading}
              onSelect={go}
              className="bg-popover"
            />
          </ResultGrid>
        )}

        {hasQuery && (
          <div className="text-muted-foreground border-t px-4 py-2 text-xs">
            Enter öffnet die vollständige Suche.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

