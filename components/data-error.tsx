import { AlertCircleIcon } from "lucide-react";

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

// Einheitliche Fehler-Kachel für fehlgeschlagene Server-Datenladungen. Ersetzt die
// früher pro Seite duplizierten Alerts. `rateLimited` zeigt den 429-Hinweis.
export function DataError({
  title = "Daten konnten nicht geladen werden",
  rateLimited = false,
}: {
  title?: string;
  rateLimited?: boolean;
}) {
  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {rateLimited
          ? "Rate-Limit erreicht (429). Bitte kurz warten und erneut versuchen."
          : "Bitte später erneut versuchen."}
      </AlertDescription>
    </Alert>
  );
}
