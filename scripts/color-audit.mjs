// Farbsystem v2 – Kontrast-Audit (warm-achromatisch, ElevenLabs-Vorbild).
// Reine Verifikation: konvertiert OKLCH<->sRGB (Ottosson), rechnet WCAG-Kontrast,
// compositet Alpha-Tints wie der Browser (im gamma-sRGB-Raum). Kein App-Code.
//
// Aufruf:  node scripts/color-audit.mjs
// Optional: node scripts/color-audit.mjs --hex   (Anker-Hex -> OKLCH ausgeben)

/* ---------- OKLCH / OKLab / sRGB ---------- */

function srgbEncode(c) {
  // linear -> gamma sRGB, geklemmt in Gamut
  c = Math.min(1, Math.max(0, c));
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}
function srgbDecode(c) {
  // gamma sRGB -> linear (WCAG-Linearisierung)
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function oklchToSrgb({ L, C, H }) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return [srgbEncode(r), srgbEncode(g), srgbEncode(bb)]; // gamma sRGB 0..1
}

function srgbToHex([r, g, b]) {
  const h = (x) => Math.round(x * 255).toString(16).padStart(2, "0");
  return "#" + h(r) + h(g) + h(b);
}

function hexToSrgb(hex) {
  hex = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
}

function srgbToOklch([r, g, b]) {
  const lin = (c) => srgbDecode(c);
  const R = lin(r), G = lin(g), B = lin(b);
  const l = 0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B;
  const m = 0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B;
  const s = 0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const C = Math.hypot(a, bb);
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H };
}

/* ---------- WCAG ---------- */

function luminance([r, g, b]) {
  return 0.2126 * srgbDecode(r) + 0.7152 * srgbDecode(g) + 0.0722 * srgbDecode(b);
}
function contrast(fg, bg) {
  const a = luminance(fg) + 0.05, b = luminance(bg) + 0.05;
  return a > b ? a / b : b / a;
}
// fg mit Alpha ueber bg legen (Browser: Komposition im gamma-sRGB-Raum)
function over(fgSrgb, alpha, bgSrgb) {
  return fgSrgb.map((c, i) => c * alpha + bgSrgb[i] * (1 - alpha));
}

/* ---------- Token-Definitionen (Farbsystem v2) ---------- */

const ok = (L, C, H) => ({ L, C, H });

const light = {
  background: ok(0.992, 0.0015, 60),
  foreground: ok(0.205, 0.006, 60),
  card: ok(1, 0, 0),
  cardForeground: ok(0.205, 0.006, 60),
  muted: ok(0.965, 0.003, 70),
  mutedForeground: ok(0.555, 0.012, 65),
  secondaryForeground: ok(0.205, 0.006, 60),
  accentForeground: ok(0.205, 0.006, 60),
  primary: ok(0.205, 0.006, 60),
  primaryForeground: ok(0.992, 0.0015, 60),
  border: ok(0.916, 0.003, 70),
  input: ok(0.916, 0.003, 70),
  ring: ok(0.62, 0.012, 65),
  destructive: ok(0.505, 0.155, 32),
  warning: ok(0.515, 0.097, 68),
  success: ok(0.515, 0.085, 150),
  chart1: ok(0.45, 0.015, 60),   // Warm-Anthrazit-Stein (Haupt-Balken)
  chart2: ok(0.52, 0.1, 250),    // gedaempftes Stahlblau (Signal Blue entsaettigt)
  chart3: ok(0.585, 0.13, 38),   // gedaempftes Ember/Terrakotta
  chart4: ok(0.6, 0.013, 70),    // mittlerer Warm-Stein
  chart5: ok(0.655, 0.012, 75),  // helles Taupe (noch >=3:1 auf Weiss)
  sidebar: ok(0.965, 0.003, 70),
  sidebarForeground: ok(0.37, 0.008, 60),
  sidebarAccent: ok(0.935, 0.004, 70),
  sidebarBorder: ok(0.916, 0.003, 70),
};

const dark = {
  background: ok(0.175, 0.006, 60),
  foreground: ok(0.955, 0.003, 80),
  card: ok(0.213, 0.007, 60),
  cardForeground: ok(0.955, 0.003, 80),
  muted: ok(0.27, 0.008, 65),
  mutedForeground: ok(0.715, 0.014, 70),
  secondaryForeground: ok(0.955, 0.003, 80),
  accentForeground: ok(0.955, 0.003, 80),
  primary: ok(0.955, 0.003, 80),
  primaryForeground: ok(0.205, 0.006, 60),
  border: ok(0.3, 0.006, 65),
  input: ok(0.33, 0.006, 65),
  ring: ok(0.5, 0.01, 65),
  destructive: ok(0.7, 0.16, 30),
  warning: ok(0.8, 0.105, 75),
  success: ok(0.75, 0.1, 152),
  chart1: ok(0.78, 0.013, 75),   // helles Warm-Stein (Haupt-Balken auf Dunkel)
  chart2: ok(0.62, 0.1, 250),    // gedaempftes Stahlblau
  chart3: ok(0.66, 0.13, 40),    // gedaempftes Ember
  chart4: ok(0.58, 0.013, 70),   // mittlerer Warm-Stein
  chart5: ok(0.53, 0.012, 65),   // tiefer Warm-Stein (noch >=3:1 auf Karte)
  sidebar: ok(0.198, 0.006, 60),
  sidebarForeground: ok(0.78, 0.01, 75),
  sidebarAccent: ok(0.255, 0.008, 65),
  sidebarBorder: ok(0.3, 0.006, 65),
};

/* ---------- Checks ---------- */

const PASS = "PASS", FAIL = "FAIL";
function row(name, ratio, min) {
  const ok = ratio >= min;
  return `  ${ok ? PASS : FAIL}  ${ratio.toFixed(2).padStart(6)} (>=${min})  ${name}`;
}

function auditMode(label, t) {
  const s = (tok) => oklchToSrgb(tok);
  const lines = [];
  let allOk = true;
  const check = (name, fg, bg, min) => {
    const r = contrast(fg, bg);
    if (r < min) allOk = false;
    lines.push(row(name, r, min));
  };

  // Text >= 4.5
  check("foreground / background", s(t.foreground), s(t.background), 4.5);
  check("card-foreground / card", s(t.cardForeground), s(t.card), 4.5);
  check("muted-foreground / background", s(t.mutedForeground), s(t.background), 4.5);
  check("muted-foreground / card", s(t.mutedForeground), s(t.card), 4.5);
  check("primary-foreground / primary  (default badge/button)", s(t.primaryForeground), s(t.primary), 4.5);

  // Tint-Badges: Token-Text auf (Token-Tint ueber Karte). Hell 10/15 %, Dunkel 20 %.
  const tintA = label === "LIGHT" ? { dest: 0.1, succ: 0.1, warn: 0.15 } : { dest: 0.2, succ: 0.2, warn: 0.2 };
  const onCard = (tok, a) => over(s(tok), a, s(t.card));
  const onBg = (tok, a) => over(s(tok), a, s(t.background));
  check("destructive badge text / tint-on-card", s(t.destructive), onCard(t.destructive, tintA.dest), 4.5);
  check("destructive badge text / tint-on-bg", s(t.destructive), onBg(t.destructive, tintA.dest), 4.5);
  check("success badge text / tint-on-card", s(t.success), onCard(t.success, tintA.succ), 4.5);
  check("success badge text / tint-on-bg", s(t.success), onBg(t.success, tintA.succ), 4.5);
  check("warning badge text / tint-on-card", s(t.warning), onCard(t.warning, tintA.warn), 4.5);
  check("warning badge text / tint-on-bg", s(t.warning), onBg(t.warning, tintA.warn), 4.5);

  // Solid white-on-destructive: in der App existiert KEINE Vollflaeche destructive
  // (alle Nutzungen sind getintet). Im Hellmodus pruefen wir den Anspruch der
  // Vorgabe trotzdem (Token dunkel genug). Im Dunkelmodus N/A: dort ist der
  // destructive-Token absichtlich hell (Tint-Text) – Vollflaeche kommt nie vor.
  if (label === "LIGHT") {
    check("white text / destructive solid (hypothetisch)", s(t.background), s(t.destructive), 4.5);
  } else {
    lines.push(`  N/A           white text / destructive solid (keine Vollflaeche im Dunkelmodus)`);
  }

  // Sidebar
  check("sidebar-foreground / sidebar  (Nav-Label)", s(t.sidebarForeground), s(t.sidebar), 4.5);
  check("accent-foreground / sidebar-accent  (Hover-Label)", s(t.foreground), s(t.sidebarAccent), 4.5);
  // Aktiver Nav-Eintrag: Label auf Pill (primary@10% ueber Sidebar)
  const navPill = over(s(t.primary), 0.1, s(t.sidebar));
  check("nav-label / aktiver Pill (primary/10)", s(t.sidebarForeground), navPill, 4.5);
  check("aktives Icon (primary) / Pill", s(t.primary), navPill, 3.0);

  // Chart-Fuellungen als grafische Objekte >= 3:1 gegen Karte
  for (const ck of ["chart1", "chart2", "chart3", "chart4", "chart5"]) {
    check(`${ck} fill / card`, s(t[ck]), s(t.card), 3.0);
  }

  // UI-Kanten >= 3:1 (funktional): Focus-Ring gegen Hintergrund
  check("ring / background", s(t.ring), s(t.background), 3.0);
  // Dekorative Hairline (informativ, kein AA-Pflichtwert): border gegen bg/card
  const borderBg = contrast(s(t.border), s(t.background));
  const borderCard = contrast(s(t.border), s(t.card));
  lines.push(`  INFO  ${borderBg.toFixed(2).padStart(6)}        border / background (Hairline, dekorativ)`);
  lines.push(`  INFO  ${borderCard.toFixed(2).padStart(6)}        border / card (Hairline, dekorativ)`);
  // Card-Elevation: sichtbarer Unterschied Karte vs. Canvas
  const cardElev = contrast(s(t.card), s(t.background));
  lines.push(`  INFO  ${cardElev.toFixed(3).padStart(6)}       card / background (Elevation-Delta)`);

  return { label, lines, allOk };
}

if (process.argv.includes("--hex")) {
  const anchors = {
    bgEggshell: "#fdfcfc", mutedPowder: "#f5f3f1", gravel: "#777169",
    chalk: "#e5e5e5", ring: "#a59f97", ember: "#ff4704", signalBlue: "#0447ff",
    darkBg: "#161412", darkCard: "#1d1b19", darkFg: "#f5f3f1", darkMutedFg: "#a59f97",
  };
  console.log("Anker-Hex -> OKLCH:");
  for (const [k, v] of Object.entries(anchors)) {
    const { L, C, H } = srgbToOklch(hexToSrgb(v));
    console.log(`  ${k.padEnd(12)} ${v}  oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})`);
  }
  process.exit(0);
}

// sRGB-Hex der Tokens zur Sichtkontrolle + Audit
function dumpHex(label, t) {
  console.log(`\n${label} – Token-Hex (Sichtkontrolle):`);
  for (const [k, tok] of Object.entries(t)) {
    console.log(`  ${k.padEnd(20)} oklch(${tok.L} ${tok.C} ${tok.H})  ${srgbToHex(oklchToSrgb(tok))}`);
  }
}

for (const [label, t] of [["LIGHT", light], ["DARK", dark]]) {
  dumpHex(label, t);
}

console.log("\n===== KONTRAST-AUDIT =====");
let allPass = true;
for (const [label, t] of [["LIGHT", light], ["DARK", dark]]) {
  const res = auditMode(label, t);
  console.log(`\n[${res.label}]`);
  res.lines.forEach((l) => console.log(l));
  allPass = allPass && res.allOk;
}
console.log(`\n===== ${allPass ? "ALLE PFLICHT-CHECKS BESTANDEN" : "ES GIBT FEHLSCHLAEGE"} =====`);
process.exit(allPass ? 0 : 1);
