// Generiert die PWA-Icons aus dem bestehenden App-Logo (public/autotask-logo.png).
// Reproduzierbar: bei neuem Logo einfach erneut ausführen -> alle PNGs neu.
//   node scripts/generate-pwa-icons.mjs
//
// Erzeugt nach /public:
//   icon-192.png            192x192  purpose "any"   (Full-Bleed-Logo)
//   icon-512.png            512x512  purpose "any"
//   icon-maskable-512.png   512x512  purpose "maskable" (Logo mit Sicherheitsrand)
//   apple-touch-icon.png    180x180  iOS-Homescreen
//
// Markenorange = #fc573b (Logo-Hintergrund), aus dem Logo abgetastet.

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");
const SRC = join(PUBLIC, "autotask-logo.png");
const BRAND = { r: 0xfc, g: 0x57, b: 0x3b, alpha: 1 }; // #fc573b

// Full-Bleed: Logo quadratisch auf Zielgröße (Hintergrund ist bereits orange).
async function anyIcon(size, out) {
  await sharp(SRC)
    .resize(size, size, { fit: "cover" })
    .flatten({ background: BRAND })
    .png()
    .toFile(join(PUBLIC, out));
}

// Maskable: Logo auf 80% skalieren und mit Orange auf volle Größe auffüllen,
// damit das Zeichen sicher in der zentralen 80%-Sicherheitszone liegt.
async function maskableIcon(size, out) {
  const inner = Math.round(size * 0.72);
  const pad = Math.round((size - inner) / 2);
  const logo = await sharp(SRC)
    .resize(inner, inner, { fit: "cover" })
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND,
    },
  })
    .composite([{ input: logo, top: pad, left: pad }])
    .png()
    .toFile(join(PUBLIC, out));
}

await anyIcon(192, "icon-192.png");
await anyIcon(512, "icon-512.png");
await maskableIcon(512, "icon-maskable-512.png");
await anyIcon(180, "apple-touch-icon.png");

console.log("PWA-Icons erzeugt: icon-192, icon-512, icon-maskable-512, apple-touch-icon");
