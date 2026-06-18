"use client";

import * as React from "react";
import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import {
  TextB,
  TextItalic,
  TextUnderline,
  ListBullets,
  ListNumbers,
  Eraser,
} from "@phosphor-icons/react/ssr";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { sanitizeRichHtml } from "@/lib/html/sanitize-rich";

// WYSIWYG-Composer für den Kunden-Chat. Editor-Engine ist Tiptap v3 (ProseMirror) –
// KEIN selbstgebautes contentEditable/execCommand mehr. Die Toolbar ist aus den
// vorhandenen shadcn-Bausteinen (Button/Tooltip/Separator) komponiert; Format-Subset
// bewusst klein: fett/kursiv/unterstrichen + Listen, plus Formatierung-entfernen.
//
// Ausgabe-Vertrag (unverändert ggü. der alten Komponente, damit TicketChat & Backend
// nichts merken): onChange liefert { html, text }. html ist IMMER durch sanitizeRichHtml
// normalisiert (nur strong/em/u/ul/ol/li/p/br, keine Attribute); ein leerer Editor
// liefert { html: "", text: "" } – kein „<p></p>" rutscht als echte Nachricht durch.

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

// Aus dem Editor-Zustand den Ausgabe-Vertrag ableiten. Leer (oder nur Whitespace) →
// strikt „nichts", damit Tiptaps Default-Absatz nicht als Inhalt zählt.
function computeOutput(editor: Editor): { html: string; text: string } {
  const text = editor
    .getText({ blockSeparator: "\n" })
    .replace(/ /g, " ")
    .trim();
  if (editor.isEmpty || text.length === 0) return { html: "", text: "" };
  return { html: sanitizeRichHtml(editor.getHTML()), text };
}

export const RichTextEditor = React.forwardRef<
  RichTextEditorHandle,
  RichTextEditorProps
>(function RichTextEditor(
  { onChange, placeholder, ariaLabel, className, disabled },
  ref,
) {
  // onChange in einem Ref halten, damit sich der Editor (useEditor) nicht bei jeder
  // neuen Callback-Identität neu aufbaut.
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    immediatelyRender: false, // SSR-sicher (Next/React 19): erst nach Mount rendern.
    extensions: [
      StarterKit.configure({
        // Auf chat-taugliches Markup beschränken – alles andere raus.
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        link: false,
        // Dropcursor aus: sonst zeigt ProseMirror beim Datei-Ziehen über den Editor
        // eine Einfüge-Linie. Datei-Drag&Drop übernimmt der gesamte Chat-Bereich
        // (CardContent in ticket-chat.tsx), der Editor soll dabei nichts visualisieren.
        dropcursor: false,
      }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
        // Editierfläche: ProseMirror-Root. Höhe/Listen/Placeholder über Tailwind-
        // Utilities (kein Custom-CSS). Placeholder nutzt das von Tiptap gesetzte
        // data-placeholder am leeren ersten Absatz.
        class: cn(
          "min-h-16 outline-none",
          "[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5",
          "[&_p.is-editor-empty:first-child]:before:text-muted-foreground [&_p.is-editor-empty:first-child]:before:pointer-events-none [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]",
        ),
      },
    },
    onUpdate({ editor }) {
      onChangeRef.current(computeOutput(editor));
    },
  });

  // disabled sauber spiegeln.
  React.useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  React.useImperativeHandle(
    ref,
    () => ({
      clear() {
        editor?.commands.clearContent(true);
        onChangeRef.current({ html: "", text: "" });
      },
      focus() {
        editor?.commands.focus();
      },
      setHtml(html: string) {
        if (!editor) return;
        const sanitized = sanitizeRichHtml(html);
        editor.commands.setContent(sanitized || "", { emitUpdate: true });
      },
    }),
    [editor],
  );

  // Aktiv-/Verfügbar-Zustände der Toolbar reaktiv aus dem Editor ziehen.
  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            bold: editor.isActive("bold"),
            italic: editor.isActive("italic"),
            underline: editor.isActive("underline"),
            bullet: editor.isActive("bulletList"),
            ordered: editor.isActive("orderedList"),
          }
        : null,
  });

  const toolbarDisabled = disabled || !editor;

  return (
    <TooltipProvider>
      <div className={cn("flex flex-col gap-2", className)}>
        <div className="flex flex-wrap items-center gap-1">
          <ToolbarButton
            label="Fett"
            icon={TextB}
            disabled={toolbarDisabled}
            active={state?.bold}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            label="Kursiv"
            icon={TextItalic}
            disabled={toolbarDisabled}
            active={state?.italic}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            label="Unterstrichen"
            icon={TextUnderline}
            disabled={toolbarDisabled}
            active={state?.underline}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          />

          <Separator orientation="vertical" className="mx-0.5 !h-5" />

          <ToolbarButton
            label="Stichpunkte"
            icon={ListBullets}
            disabled={toolbarDisabled}
            active={state?.bullet}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            label="Nummerierte Liste"
            icon={ListNumbers}
            disabled={toolbarDisabled}
            active={state?.ordered}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          />

          <Separator orientation="vertical" className="mx-0.5 !h-5" />

          <ToolbarButton
            label="Formatierung entfernen"
            icon={Eraser}
            disabled={toolbarDisabled}
            onClick={() =>
              editor?.chain().focus().unsetAllMarks().clearNodes().run()
            }
          />
        </div>

        <EditorContent
          editor={editor}
          className={cn(
            "border-input bg-transparent text-foreground max-h-[50dvh] resize-y overflow-y-auto rounded-md border px-3 py-2 text-sm shadow-xs",
            "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
            disabled && "cursor-not-allowed opacity-50",
          )}
        />
      </div>
    </TooltipProvider>
  );
});

// Einzelner Toolbar-Knopf: shadcn-Button in einem Tooltip. Toggle-Knöpfe melden
// `aria-pressed`; Aktions-Knöpfe (Formatierung entfernen) nicht. onMouseDown verhindert den
// Fokusverlust, damit das Toggle auf die aktuelle Auswahl wirkt.
function ToolbarButton({
  label,
  icon: Icon,
  onClick,
  active,
  disabled,
}: {
  label: string;
  icon: typeof TextB;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  const isToggle = active !== undefined;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "size-11 sm:size-8",
              active && "bg-accent text-accent-foreground",
            )}
            aria-label={label}
            aria-pressed={isToggle ? !!active : undefined}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
          />
        }
      >
        <Icon className="size-4" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
