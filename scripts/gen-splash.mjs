// Generiert iOS-PWA-Startbilder (apple-touch-startup-image) für die gängigen
// iPhone-Auflösungen, je in Hell und Dunkel. iOS zeigt beim Kaltstart einer
// installierten PWA so lange dieses Bild, bis der erste Frame gerendert ist –
// ohne passendes Bild bleibt der Schirm WEISS („fühlt sich eingefroren an").
// Bewusst statt Service Worker (siehe docs/DECISIONS.md): nur eine visuelle
// Ueberbbrueckung der nativen Startphase, kein Caching von Live-Daten.
//
// Erzeugt PNGs in public/splash/ UND lib/splash-screens.ts (das Array fuer
// metadata.appleWebApp.startupImage). Aufruf: `node scripts/gen-splash.mjs`.
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "splash");
const LOGO = join(ROOT, "public", "autotask-logo-mark.png");

// Hell = Eggshell (--background hell), Dunkel = warmes Fast-Schwarz (v2-Token).
const BG = { light: "#fdfcfb", dark: "#13100e" };

// Portrait-Auflösungen gaengiger iPhones (CSS-Punkte + Device-Pixel-Ratio).
// Native Pixel = w*r x h*r. Deckt iPhone SE bis 16 Pro Max ab.
const DEVICES = [
  { w: 320, h: 568, r: 2 }, // SE (1. Gen), 5/5s/SE
  { w: 375, h: 667, r: 2 }, // 8, SE (2./3. Gen)
  { w: 414, h: 736, r: 3 }, // 8 Plus
  { w: 375, h: 812, r: 3 }, // X, XS, 11 Pro, 12/13 mini
  { w: 390, h: 844, r: 3 }, // 12, 12 Pro, 13, 13 Pro, 14
  { w: 393, h: 852, r: 3 }, // 14 Pro, 15, 15 Pro, 16
  { w: 402, h: 874, r: 3 }, // 16 Pro
  { w: 414, h: 896, r: 2 }, // XR, 11
  { w: 414, h: 896, r: 3 }, // XS Max, 11 Pro Max
  { w: 428, h: 926, r: 3 }, // 12/13 Pro Max, 14 Plus
  { w: 430, h: 932, r: 3 }, // 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  { w: 440, h: 956, r: 3 }, // 16 Pro Max
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const entries = [];
  for (const { w, h, r } of DEVICES) {
    const pxW = w * r;
    const pxH = h * r;
    // Logo ~32% der kuerzeren Kante, scharf in nativer Aufloesung.
    const logoSize = Math.round(Math.min(pxW, pxH) * 0.32);
    const logoBuf = await sharp(LOGO)
      .resize(logoSize, logoSize, { fit: "contain", background: "#00000000" })
      .png()
      .toBuffer();

    for (const scheme of ["light", "dark"]) {
      const file = `splash-${w}x${h}@${r}x-${scheme}.png`;
      await sharp({
        create: {
          width: pxW,
          height: pxH,
          channels: 4,
          background: BG[scheme],
        },
      })
        .composite([{ input: logoBuf, gravity: "center" }])
        .png()
        .toFile(join(OUT_DIR, file));

      const media =
        `(prefers-color-scheme: ${scheme}) and ` +
        `(device-width: ${w}px) and (device-height: ${h}px) and ` +
        `(-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`;
      entries.push({ url: `/splash/${file}`, media });
    }
  }

  const ts =
    `// AUTO-GENERIERT von scripts/gen-splash.mjs – nicht von Hand editieren.\n` +
    `// iOS-PWA-Startbilder (apple-touch-startup-image) je iPhone-Groesse, Hell/Dunkel.\n` +
    `export const appleStartupImages: { url: string; media: string }[] = ${JSON.stringify(
      entries,
      null,
      2,
    )};\n`;
  await writeFile(join(ROOT, "lib", "splash-screens.ts"), ts, "utf8");

  console.log(
    `splash: ${DEVICES.length * 2} PNGs in public/splash/, ${entries.length} Eintraege in lib/splash-screens.ts`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
