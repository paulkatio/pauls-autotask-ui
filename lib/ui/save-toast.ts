import { toast } from "sonner";

// Einheitliches Speicher-Feedback für die GANZE Oberfläche. Beim Start einer
// Schreibaktion erscheint sofort ein Lade-Toast (Spinner) – so sieht man überall
// gleich, dass gerade etwas passiert, statt eines scheinbaren „Hängers". Bei Erfolg
// wird derselbe Toast zur Erfolgsmeldung; bei Fehler verschwindet er wieder und der
// Fehler wird weitergereicht (die aufrufende Stelle zeigt ihn wie gehabt inline an).
//
// Verwendung:
//   const res = await saveToast(() => patchTicket(id, {...}), { success: "Zugewiesen." });
export async function saveToast<T>(
  run: () => Promise<T>,
  messages?: { loading?: string; success?: string },
): Promise<T> {
  const id = toast.loading(messages?.loading ?? "Speichern …");
  try {
    const result = await run();
    toast.success(messages?.success ?? "Gespeichert.", { id });
    return result;
  } catch (e) {
    // Lade-Toast entfernen; den Fehler zeigt der Aufrufer (inline/eigener Toast).
    toast.dismiss(id);
    throw e;
  }
}
