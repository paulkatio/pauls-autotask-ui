import { TicketIcon } from "lucide-react";

import { loginAs } from "@/lib/auth/actions";
import { signInEntra } from "@/lib/auth/entra-actions";
import { authMode } from "@/lib/auth";
import { mockUsers } from "@/lib/auth/mock-users";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const mode = authMode();
  const { error } = await searchParams;

  return (
    <main className="bg-background flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center justify-center gap-2.5">
          <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg">
            <TicketIcon className="size-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            Autotask UI
          </span>
        </div>
        <Card className="w-full">
        <CardHeader>
          <CardTitle>Anmelden</CardTitle>
          <CardDescription>
            {mode === "mock"
              ? "Mock-Modus – wähle einen Sandbox-Benutzer."
              : "Anmeldung über Microsoft Entra ID."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                Anmeldung fehlgeschlagen oder abgebrochen. Bitte erneut versuchen.
              </AlertDescription>
            </Alert>
          )}

          {mode === "mock" ? (
            mockUsers.map((u) => (
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
            ))
          ) : (
            <form action={signInEntra}>
              <Button type="submit" className="w-full">
                Mit Microsoft anmelden
              </Button>
            </form>
          )}
        </CardContent>
        </Card>
      </div>
    </main>
  );
}
