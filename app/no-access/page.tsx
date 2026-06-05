import { ShieldAlertIcon } from "lucide-react";

import { auth } from "@/lib/auth/authjs";
import { signOutEntra } from "@/lib/auth/entra-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

// Entra-Login war erfolgreich, aber zur E-Mail gibt es keine (aktive) Autotask-
// Resource. Bewusst KEINE halbe Session – klarer Zugriffsfehler + Abmelden.
export default async function NoAccessPage() {
  const session = await auth();
  const email = (session?.user as { email?: string } | undefined)?.email;

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Kein Zugriff</CardTitle>
        </CardHeader>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ShieldAlertIcon />
              </EmptyMedia>
              <EmptyTitle>Kein Autotask-Zugang für diese E-Mail</EmptyTitle>
              <EmptyDescription>
                Die Anmeldung über Microsoft hat funktioniert, aber zu{" "}
                {email ? (
                  <span className="text-foreground font-medium">{email}</span>
                ) : (
                  "deiner E-Mail-Adresse"
                )}{" "}
                ist keine aktive Autotask-Resource hinterlegt. Bitte wende dich an
                die Administration.
              </EmptyDescription>
            </EmptyHeader>
            <form action={signOutEntra}>
              <Button type="submit" variant="outline">
                Abmelden
              </Button>
            </form>
          </Empty>
        </CardContent>
      </Card>
    </main>
  );
}
