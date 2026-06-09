// Öffnet einen Datensatz (Ticket/Firma) in einem EIGENEN Browser-Fenster (Popup) –
// so wie Autotask ein Ticket in einem Pop-out-Fenster öffnet. Pro Datensatz ein
// benanntes Fenster (window name = `${typ}-${id}`), damit wiederholtes Klicken
// dasselbe Fenster wiederverwendet statt viele zu öffnen.
// Kontakte öffnen NICHT hierüber – die laufen als In-App-Overlay.

function openRecordPopup(path: string, name: string, width = 1200): void {
  if (typeof window === "undefined") return;
  const w = width;
  const h = 860;
  const left = Math.round(
    window.screenX + Math.max(0, (window.outerWidth - w) / 2),
  );
  const top = Math.round(
    window.screenY + Math.max(0, (window.outerHeight - h) / 2),
  );
  const features = `popup=yes,width=${w},height=${h},left=${left},top=${top},noopener=no,scrollbars=yes,resizable=yes`;
  const win = window.open(path, name, features);
  win?.focus();
}

export function openTicketPopup(id: number): void {
  // 1360 > xl (1280): Ticketdetail startet im 3-Spalten-Layout mit Chat-Rail rechts,
  // statt den Chat unter den Aktivitäts-Feed zu wrappen.
  openRecordPopup(`/popup/tickets/${id}`, `ticket-${id}`, 1360);
}

export function openCompanyPopup(id: number): void {
  openRecordPopup(`/popup/companies/${id}`, `company-${id}`);
}
