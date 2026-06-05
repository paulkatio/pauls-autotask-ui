import Image from "next/image";

import { loginAs } from "@/lib/auth/actions";
import { signInEntra } from "@/lib/auth/entra-actions";
import { authMode } from "@/lib/auth";
import { mockUsers } from "@/lib/auth/mock-users";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
// Statischer Import: Next vergibt eine inhalts-gehashte, optimierte URL.
import autotaskLogo from "../../public/autotask-logo.png";

// Offizielles Microsoft-Markenzeichen (4 Quadrate). Kein lucide-Pendant vorhanden;
// die Hex-Farben sind die Markenfarben und gehören fest zum Logo (kein freies Design).
function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 21 21" className="size-5 shrink-0" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const mode = authMode();
  const { error } = await searchParams;

  return (
    <main className="bg-background flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image
            src={autotaskLogo}
            alt="Autotask UI"
            width={64}
            height={64}
            priority
            className="size-16 rounded-2xl shadow-sm"
          />
          <div className="flex flex-col gap-1">
            <span className="text-2xl font-semibold tracking-tight">
              Autotask UI
            </span>
            <span className="text-muted-foreground text-sm">SSIG-IT GmbH</span>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                Anmeldung fehlgeschlagen oder abgebrochen. Bitte erneut versuchen.
              </AlertDescription>
            </Alert>
          )}

          {mode === "mock" ? (
            <>
              <span className="text-muted-foreground text-center text-sm">
                Mock-Modus – Sandbox-Benutzer wählen
              </span>
              {mockUsers.map((u) => (
                <form key={u.userName} action={loginAs}>
                  <input type="hidden" name="userName" value={u.userName} />
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full justify-start"
                  >
                    {u.displayName}
                  </Button>
                </form>
              ))}
            </>
          ) : (
            <form action={signInEntra} className="w-full">
              <Button
                type="submit"
                variant="outline"
                className="h-12 w-full gap-3 text-base"
              >
                <MicrosoftLogo />
                Mit Microsoft anmelden
              </Button>
            </form>
          )}
        </div>

        <p className="text-muted-foreground text-center text-xs text-balance">
          Interne Anwendung – Zugriff nur für berechtigte Mitarbeiter.
        </p>
      </div>
    </main>
  );
}
