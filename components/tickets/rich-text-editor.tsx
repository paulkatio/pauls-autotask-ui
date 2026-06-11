"use client";

import * as React from "react";
import { BoldIcon, ItalicIcon, UnderlineIcon, ListIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { sanitizeRichHtml } from "@/lib/html/sanitize-rich";

// Leichter WYSIWYG-Editor für den Chat: kleiner Format-Subset (fett/kursiv/
// unterstrichen/Stichpunkte) über eine Toolbar aus shadcn-Buttons + ein
// contentEditable als Eingabefläche (wie eine Textarea, gleiche Token-Optik).
// Das resizable Eingabefeld (resize-y) erfüllt zugleich Pauls Wunsch nach einem
// vergrößerbaren „Nachricht an den Kunden"-Fenster.
//
// Ausgabe ist IMMER durch sanitizeRichHtml normalisiert: nur b/i/u/ul/ol/li/br,
// keine Attribute. document.execCommand ist veraltet, aber überall verfügbar und
// hier der pragmatische Weg ohne schwere Editor-Bibliothek.

export interface RichTextEditorHandle {
  clear(): void;
  focus(): void;
  setHtml(html: string): void;
}

interface RichTextEditorProps {
  onChange: (value: { html: string; text: string }) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}

export const RichTextEditor = React.forwardRef<
  RichTextEditorHandle,
  RichTextEditorProps
>(function RichTextEditor(
  { onChange, placeholder, ariaLabel, className, disabled },
  ref,
) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = React.useState(true);

  const emit = React.useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = sanitizeRichHtml(el.innerHTML);
    const text = (el.textContent ?? "").replace(/ /g, " ").trim();
    setEmpty(text.length === 0);
    onChange({ html, text });
  }, [onChange]);

  React.useImperativeHandle(ref, () => ({
    clear() {
      const el = editorRef.current;
      if (el) el.innerHTML = "";
      setEmpty(true);
      onChange({ html: "", text: "" });
    },
    focus() {
      editorRef.current?.focus();
    },
    setHtml(html: string) {
      const el = editorRef.current;
      if (el) el.innerHTML = html;
      emit();
    },
  }));

  function exec(command: string) {
    if (disabled) return;
    editorRef.current?.focus();
    // Tags statt Inline-Styles bevorzugen (<b>/<i>/<u> statt <span style>).
    try {
      document.execCommand("styleWithCSS", false, "false");
    } catch {
      /* ignore */
    }
    try {
      document.execCommand(command);
    } catch {
      /* ignore */
    }
    emit();
  }

  const tools: { cmd: string; label: string; Icon: typeof BoldIcon }[] = [
    { cmd: "bold", label: "Fett", Icon: BoldIcon },
    { cmd: "italic", label: "Kursiv", Icon: ItalicIcon },
    { cmd: "underline", label: "Unterstrichen", Icon: UnderlineIcon },
    { cmd: "insertUnorderedList", label: "Stichpunkte", Icon: ListIcon },
  ];

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-1">
        {tools.map(({ cmd, label, Icon }, i) => (
          <React.Fragment key={cmd}>
            {i === 3 && (
              <Separator orientation="vertical" className="mx-0.5 !h-5" />
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={disabled}
              aria-label={label}
              title={label}
              // Fokus/Selektion im Editor nicht verlieren, bevor execCommand greift.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec(cmd)}
            >
              <Icon className="size-4" />
            </Button>
          </React.Fragment>
        ))}
      </div>
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable={!disabled}
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          className={cn(
            "border-input bg-transparent text-foreground min-h-16 max-h-[50dvh] resize-y overflow-y-auto rounded-md border px-3 py-2 text-sm shadow-xs outline-none",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5",
            disabled && "cursor-not-allowed opacity-50",
          )}
        />
        {empty && placeholder && (
          <span className="text-muted-foreground pointer-events-none absolute top-2 left-3 text-sm">
            {placeholder}
          </span>
        )}
      </div>
    </div>
  );
});
