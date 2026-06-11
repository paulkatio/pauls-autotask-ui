// Strikter Allowlist-Sanitizer für den kleinen Rich-Text-Subset des Chats
// (fett/kursiv/unterstrichen/Listen). BEWUSST client-safe (kein "server-only"),
// damit ihn sowohl der Schreibpfad (Server: Notiz/Mail) als auch die Anzeige
// (Client: Chat-Bubble) nutzen können.
//
// SICHERHEIT: Der Output besteht AUSSCHLIESSLICH aus diesem festen Tag-Set OHNE
// jegliche Attribute. Eingehende Attribute, unbekannte Tags und Skripte werden
// verworfen. Dadurch ist das Ergebnis selbst bei bösartiger Eingabe XSS-sicher
// (kein href/onerror/style überlebt, kein <script>/<img> wird je ausgegeben).

// Erlaubte Tags -> normalisierte Ausgabe (b->strong, i->em).
const ALLOWED: Record<string, string> = {
  b: "strong",
  strong: "strong",
  i: "em",
  em: "em",
  u: "u",
  ul: "ul",
  ol: "ol",
  li: "li",
  p: "p",
  br: "br",
};
// Void-Tags (kein schließendes Pendant).
const VOID = new Set(["br"]);
// Bekannte, aber NICHT erlaubte Tags: werden als Tag erkannt und verworfen, ihr
// Textinhalt bleibt erhalten. `div`/`p`-Ende eines contentEditable nähern wir als
// Zeilenumbruch an, damit Absätze nicht zusammenkleben.
const KNOWN_DROP = new Set([
  "div",
  "span",
  "a",
  "font",
  "script",
  "style",
  "img",
  "table",
  "tr",
  "td",
  "h1",
  "h2",
  "h3",
  "blockquote",
  "pre",
  "code",
  "svg",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "link",
  "meta",
  "video",
  "audio",
  "math",
  "body",
  "html",
  "head",
]);

function escapeText(s: string): string {
  // Nur „<" ist im Textkontext gefährlich (Tag-Start). „&"/„>" bleiben unangetastet,
  // damit bereits kodierte Entities aus contentEditable-innerHTML nicht doppelt
  // kodiert werden (z. B. „&amp;" -> bliebe „&amp;amp;").
  return s.replace(/</g, "&lt;");
}

interface ParsedTag {
  name: string;
  closing: boolean;
}

function parseTag(raw: string): ParsedTag | null {
  // raw inkl. spitzer Klammern, z. B. "<b>", "</ul>", "<br/>", "<b style=…>".
  const m = /^<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)/.exec(raw);
  if (!m) return null;
  return { closing: m[1] === "/", name: m[2].toLowerCase() };
}

export function sanitizeRichHtml(input: string): string {
  if (!input) return "";
  let out = "";
  let i = 0;
  const n = input.length;
  while (i < n) {
    const lt = input.indexOf("<", i);
    if (lt < 0) {
      out += input.slice(i);
      break;
    }
    if (lt > i) out += input.slice(i, lt);
    const gt = input.indexOf(">", lt);
    if (gt < 0) {
      // Verirrtes „<" ohne schließendes „>": als Text entschärfen.
      out += escapeText(input.slice(lt));
      break;
    }
    const raw = input.slice(lt, gt + 1);
    const tag = parseTag(raw);
    if (!tag) {
      // Kein echtes Tag (z. B. „a < b"): „<" als Text entschärfen, nur 1 Zeichen
      // konsumieren, damit nachfolgender Text nicht verschluckt wird.
      out += "&lt;";
      i = lt + 1;
      continue;
    }
    const mapped = ALLOWED[tag.name];
    if (mapped) {
      if (VOID.has(mapped)) out += `<${mapped}>`;
      else out += tag.closing ? `</${mapped}>` : `<${mapped}>`;
    } else if (KNOWN_DROP.has(tag.name)) {
      // Block-Ende grob als Umbruch abbilden, Inline-Tags spurlos verwerfen.
      if (tag.closing && (tag.name === "div" || tag.name === "blockquote")) {
        out += "<br>";
      }
    } else {
      // Unbekanntes Tag: „<" entschärfen, Rest als Text behandeln.
      out += "&lt;";
      i = lt + 1;
      continue;
    }
    i = gt + 1;
  }
  // Mehrfache <br> am Stück und am Rand zusammenfassen/trimmen.
  return out
    .replace(/(?:<br>\s*){3,}/g, "<br><br>")
    .replace(/^(?:\s*<br>)+/, "")
    .replace(/(?:<br>\s*)+$/, "")
    .trim();
}

// Plaintext-Fassung des Rich-Inhalts: für die text/plain-Mailfassung, den
// Notiz-Titel und die optimistische Chat-Bubble. Listen werden zu „• …"-Zeilen.
export function plainTextFromRich(input: string): string {
  if (!input) return "";
  let s = input;
  s = s.replace(/<\s*li[^>]*>/gi, "\n• ");
  s = s.replace(/<\s*br\s*\/?>/gi, "\n");
  // `li` bewusst NICHT hier (öffnendes <li> setzt bereits "\n• "), sonst Doppel-Umbruch.
  s = s.replace(/<\s*\/\s*(p|div|ul|ol|h1|h2|h3|blockquote)\s*>/gi, "\n");
  s = s.replace(/<[^>]+>/g, ""); // restliche Tags entfernen
  // Häufige Entities zurückübersetzen (Anzeige/Plaintext).
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  return s.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim();
}

// Enthält der Text überhaupt formatiertes Markup unseres Subsets? (Entscheidet,
// ob eine Bubble als HTML gerendert wird oder weiter als Plaintext.)
export function hasRichMarkup(input: string): boolean {
  return /<\s*\/?\s*(strong|b|em|i|u|ul|ol|li|br|p)\b/i.test(input ?? "");
}
