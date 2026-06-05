import { requireSession } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";

export const dynamic = "force-dynamic";

// Sidebar-loses Layout für Pop-out-Fenster (window.open). Nur Auth-Guard + Inhalt +
// Toaster (für Inline-Edit-Bestätigungen). Theme/HTML kommen aus dem Root-Layout.
export default async function PopupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireSession();
  return (
    <div className="min-h-screen p-4 md:p-6">
      {children}
      <Toaster />
    </div>
  );
}
