import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

export function createCodeMirrorTheme(
  isDark: boolean,
  isEditable: boolean = true,
): Extension {
  const editorTheme = EditorView.theme(
    {
      "&": {
        fontSize: "1rem !important",
        backgroundColor: "var(--cm-background)",
        color: "var(--cm-foreground)",
        fontFamily:
          "'Source Code Pro', 'Fira Code', 'JetBrains Mono', 'Consolas', 'Monaco', 'Courier New', monospace !important",
      },
      ".cm-editor": {
        borderRadius: "0",
        fontFamily:
          "'Source Code Pro', 'Fira Code', 'JetBrains Mono', 'Consolas', 'Monaco', 'Courier New', monospace !important",
      },
      ".cm-scroller": {
        paddingTop: "0.75rem",
        paddingBottom: "0.75rem",
        paddingLeft: "0.5rem",
        paddingRight: "0.5rem",
        fontFamily:
          "'Source Code Pro', 'Fira Code', 'JetBrains Mono', 'Consolas', 'Monaco', 'Courier New', monospace !important",
        lineHeight: "1.6",
      },
      ".cm-line": {
        color: "var(--cm-foreground)",
        fontFamily:
          "'Source Code Pro', 'Fira Code', 'JetBrains Mono', 'Consolas', 'Monaco', 'Courier New', monospace !important",
      },
      ".cm-content": {
        color: "var(--cm-foreground)",
        caretColor: "var(--cm-caret)",
        fontFamily:
          "'Source Code Pro', 'Fira Code', 'JetBrains Mono', 'Consolas', 'Monaco', 'Courier New', monospace !important",
      },
      ".cm-gutters": {
        backgroundColor: "var(--cm-gutter-bg)",
        borderRight: "1px solid var(--border)",
        color: "var(--cm-gutter-fg)",
        fontFamily:
          "'Source Code Pro', 'Fira Code', 'JetBrains Mono', 'Consolas', 'Monaco', 'Courier New', monospace !important",
      },
      ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: "var(--cm-caret)",
      },
      ".cm-activeLine": {
        backgroundColor: "transparent",
      },
      ".cm-activeLineGutter": {
        backgroundColor: "transparent",
      },
      ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection":
        {
          backgroundColor: "var(--cm-selection)",
        },
      ".cm-searchMatch": {
        backgroundColor: "var(--cm-selection)",
        outline: "1px solid var(--cm-caret)",
      },
      ".cm-searchMatch.cm-searchMatch-selected": {
        backgroundColor: "var(--cm-selection)",
      },
      ".cm-foldPlaceholder": {
        backgroundColor: "var(--cm-gutter-bg)",
        border: "none",
        color: "var(--cm-gutter-fg)",
      },
    },
    { dark: isDark },
  );

  const highlightStyle = HighlightStyle.define([
    { tag: t.keyword, color: "var(--cm-keyword)", fontWeight: "500" },
    {
      tag: [t.name, t.deleted, t.character, t.macroName],
      color: "var(--cm-variable)",
    },
    { tag: [t.propertyName], color: "var(--cm-property)" },
    {
      tag: [
        t.function(t.variableName),
        t.function(t.propertyName),
        t.labelName,
      ],
      color: "var(--cm-function)",
    },
    {
      tag: [t.color, t.constant(t.name), t.standard(t.name)],
      color: "var(--cm-constant)",
    },
    { tag: [t.definition(t.name), t.separator], color: "var(--cm-variable)" },
    {
      tag: [
        t.typeName,
        t.className,
        t.number,
        t.changed,
        t.annotation,
        t.modifier,
        t.self,
        t.namespace,
      ],
      color: "var(--cm-type)",
    },
    { tag: [t.number], color: "var(--cm-number)" },
    {
      tag: [
        t.operator,
        t.operatorKeyword,
        t.url,
        t.escape,
        t.regexp,
        t.link,
        t.special(t.string),
      ],
      color: "var(--cm-operator)",
    },
    { tag: [t.regexp], color: "var(--cm-regexp)" },
    {
      tag: [t.meta, t.comment],
      color: "var(--cm-comment)",
      fontStyle: "italic",
    },
    { tag: t.strong, fontWeight: "bold" },
    { tag: t.emphasis, fontStyle: "italic" },
    { tag: t.strikethrough, textDecoration: "line-through" },
    { tag: t.link, color: "var(--cm-function)", textDecoration: "underline" },
    { tag: t.heading, fontWeight: "bold", color: "var(--cm-keyword)" },
    {
      tag: [t.atom, t.bool, t.special(t.variableName)],
      color: "var(--cm-constant)",
    },
    {
      tag: [t.processingInstruction, t.string, t.inserted],
      color: "var(--cm-string)",
    },
    {
      tag: t.invalid,
      color: "var(--cm-foreground)",
      backgroundColor: "var(--destructive)",
    },
    { tag: [t.tagName], color: "var(--cm-tag)" },
    { tag: [t.attributeName], color: "var(--cm-attribute)" },
    { tag: [t.attributeValue], color: "var(--cm-string)" },
    { tag: t.punctuation, color: "var(--cm-punctuation)" },
  ]);

  return [editorTheme, syntaxHighlighting(highlightStyle)];
}
