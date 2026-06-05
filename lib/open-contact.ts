// Öffnet einen Kontakt als kompaktes In-App-Overlay (Modal) im GLEICHEN Fenster –
// anders als Ticket/Firma, die ein eigenes Browser-Fenster öffnen (lib/open-popup.ts).
// Genau ein <ContactModal/> (im Layout gemountet) hört auf openContactModal(id) und
// lädt den Kontakt nach. Event-basiert, damit jede Klickstelle ohne Prop-Drilling
// öffnen kann.

const EVENT = "open-contact-modal";

export function openContactModal(id: number): void {
  if (typeof window === "undefined" || !Number.isFinite(id)) return;
  window.dispatchEvent(new CustomEvent<number>(EVENT, { detail: id }));
}

export function subscribeOpenContact(cb: (id: number) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => cb((e as CustomEvent<number>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
