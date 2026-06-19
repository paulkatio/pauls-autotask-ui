import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { appleStartupImages } from "@/lib/splash-screens";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Autotask UI",
  description: "Fokussierte Oberfläche für Autotask-Tickets",
  // Next fügt das <link rel="manifest"> aus app/manifest.ts automatisch ein.
  // favicon.ico kommt aus app/favicon.ico (Datei-Konvention). Hier nur das
  // iOS-Homescreen-Icon ergänzen (liest Apple nicht aus dem Manifest).
  icons: {
    apple: "/apple-touch-icon.png",
  },
  // Standalone-Verhalten auf iOS (Homescreen-Start ohne Safari-Chrome).
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    // Vorausgefüllter Name beim „Zum Home-Bildschirm" in Safari (iOS liest das aus
    // apple-mobile-web-app-title, NICHT aus dem Manifest).
    title: "AutoTask UI",
    // iOS-Startbilder je iPhone-Größe (Hell/Dunkel) – überbrücken den weißen
    // Kaltstart der installierten PWA, bis der erste Frame da ist. Generiert von
    // scripts/gen-splash.mjs (kein Service Worker, siehe docs/DECISIONS.md).
    startupImage: appleStartupImages,
  },
};

// theme_color adaptiv für Hell/Dunkel (v2-Token). Das Manifest erlaubt nur
// einen statischen Wert; die media-Queries hier passen die Browser-/Statusleiste
// an das aktive Schema an. Hell = Eggshell, Dunkel = warmes Fast-Schwarz.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfcfb" },
    { media: "(prefers-color-scheme: dark)", color: "#13100e" },
  ],
  // viewport-fit=cover aktiviert env(safe-area-inset-*) auf Geräten mit Notch/
  // Home-Indikator (iPhone). Header (oben) und Bottom-Nav (unten) nutzen die Insets.
  viewportFit: "cover",
  // Mobile Tastatur verkleinert den Layout-Viewport, statt ihn nur zu überlagern →
  // der Chat-Composer am unteren Rand bleibt sichtbar (siehe ticket-chat.tsx).
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Nonce der erzwingenden CSP (aus middleware.ts) an next-themes weiterreichen,
  // damit dessen Inline-Theme-Skript unter der Policy laufen darf.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  // scrollbar-gutter:stable reserviert die Scrollbar-Spalte dauerhaft → kein
  // Breiten-Sprung, wenn sich die Inhaltshöhe ändert (z. B. Dashboard-Zeitraum)
  // oder ein Overlay den Scroll kurz sperrt.
  return (
    <html
      lang="de"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased [scrollbar-gutter:stable]`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          nonce={nonce}
        >
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
