import { EditorView } from "@codemirror/view";
import { Extension } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

// Custom dark theme matching the app's CSS variables
const editorTheme = EditorView.theme(
  {
    "&": {
      color: "var(--text-primary)",
      backgroundColor: "var(--bg-primary)",
      fontSize: "13px",
      fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace",
    },
    ".cm-content": {
      caretColor: "var(--accent)",
      padding: "12px 0",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--accent)",
      borderLeftWidth: "2px",
    },
    "&.cm-focused .cm-cursor": {
      borderLeftColor: "var(--accent)",
    },
    ".cm-selectionBackground, ::selection": {
      backgroundColor: "rgba(99, 102, 241, 0.3)",
    },
    "&.cm-focused .cm-selectionBackground, &.cm-focused ::selection": {
      backgroundColor: "rgba(99, 102, 241, 0.3)",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(255, 255, 255, 0.03)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(255, 255, 255, 0.03)",
    },
    ".cm-gutters": {
      backgroundColor: "var(--bg-secondary)",
      color: "var(--text-muted)",
      border: "none",
      borderRight: "1px solid var(--border-color)",
      minWidth: "40px",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 12px 0 8px",
      minWidth: "32px",
      textAlign: "right",
    },
    ".cm-foldGutter .cm-gutterElement": {
      padding: "0 4px",
    },
    ".cm-scroller": {
      overflow: "auto",
    },
    ".cm-placeholder": {
      color: "var(--text-muted)",
      fontStyle: "italic",
    },
    // Autocomplete menu styling
    ".cm-tooltip": {
      backgroundColor: "var(--bg-secondary)",
      border: "1px solid var(--border-color)",
      borderRadius: "8px",
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
      overflow: "hidden",
    },
    ".cm-tooltip.cm-tooltip-autocomplete": {
      "& > ul": {
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        maxHeight: "280px",
        minWidth: "220px",
      },
      "& > ul > li": {
        padding: "6px 12px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
      },
      "& > ul > li[aria-selected]": {
        backgroundColor: "var(--accent)",
        color: "white",
      },
    },
    ".cm-completionIcon": {
      width: "16px",
      height: "16px",
      marginRight: "4px",
      opacity: "0.8",
    },
    ".cm-completionLabel": {
      flex: "1",
    },
    ".cm-completionDetail": {
      color: "var(--text-muted)",
      fontSize: "12px",
      marginLeft: "8px",
    },
    // Search panel styling
    ".cm-panels": {
      backgroundColor: "var(--bg-secondary)",
      borderTop: "1px solid var(--border-color)",
    },
    ".cm-panel.cm-search": {
      padding: "8px 12px",
      display: "flex",
      gap: "8px",
      flexWrap: "wrap",
      alignItems: "center",
    },
    ".cm-panel.cm-search input, .cm-panel.cm-search button": {
      fontSize: "13px",
    },
    ".cm-panel.cm-search input": {
      backgroundColor: "var(--bg-primary)",
      border: "1px solid var(--border-color)",
      borderRadius: "4px",
      padding: "4px 8px",
      color: "var(--text-primary)",
      outline: "none",
    },
    ".cm-panel.cm-search input:focus": {
      borderColor: "var(--accent)",
    },
    ".cm-panel.cm-search button": {
      backgroundColor: "var(--bg-tertiary)",
      border: "1px solid var(--border-color)",
      borderRadius: "4px",
      padding: "4px 12px",
      color: "var(--text-secondary)",
      cursor: "pointer",
    },
    ".cm-panel.cm-search button:hover": {
      backgroundColor: "var(--border-color)",
      color: "var(--text-primary)",
    },
    ".cm-searchMatch": {
      backgroundColor: "rgba(234, 179, 8, 0.3)",
      borderRadius: "2px",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "rgba(234, 179, 8, 0.5)",
    },
    // Matching brackets
    "&.cm-focused .cm-matchingBracket": {
      backgroundColor: "rgba(99, 102, 241, 0.25)",
      outline: "1px solid rgba(99, 102, 241, 0.5)",
    },
    "&.cm-focused .cm-nonmatchingBracket": {
      backgroundColor: "rgba(239, 68, 68, 0.25)",
      outline: "1px solid rgba(239, 68, 68, 0.5)",
    },
    // Fold markers
    ".cm-foldPlaceholder": {
      backgroundColor: "var(--bg-tertiary)",
      border: "none",
      color: "var(--text-muted)",
      borderRadius: "4px",
      padding: "0 4px",
      margin: "0 2px",
    },
  },
  { dark: true }
);

// Syntax highlighting for SQL
const syntaxColors = HighlightStyle.define([
  // Keywords: SELECT, FROM, WHERE, etc.
  { tag: t.keyword, color: "#c678dd", fontWeight: "500" },

  // Built-in functions and operators
  { tag: t.operatorKeyword, color: "#c678dd" },
  { tag: t.operator, color: "#56b6c2" },

  // Data types
  { tag: t.typeName, color: "#e5c07b" },

  // Strings
  { tag: t.string, color: "#98c379" },

  // Numbers
  { tag: t.number, color: "#d19a66" },

  // Booleans and NULL
  { tag: t.bool, color: "#d19a66" },
  { tag: t.null, color: "#d19a66", fontStyle: "italic" },

  // Comments
  { tag: t.comment, color: "#5c6370", fontStyle: "italic" },
  { tag: t.lineComment, color: "#5c6370", fontStyle: "italic" },
  { tag: t.blockComment, color: "#5c6370", fontStyle: "italic" },

  // Identifiers (table names, column names)
  { tag: t.propertyName, color: "#e06c75" },
  { tag: t.name, color: "#abb2bf" },

  // Quoted identifiers
  { tag: t.special(t.string), color: "#e5c07b" },

  // Punctuation
  { tag: t.punctuation, color: "#abb2bf" },
  { tag: t.paren, color: "#abb2bf" },
  { tag: t.squareBracket, color: "#abb2bf" },

  // Labels (aliases)
  { tag: t.labelName, color: "#61afef" },

  // Standard names (built-in functions)
  { tag: t.standard(t.name), color: "#61afef" },

  // Special variables
  { tag: t.variableName, color: "#e06c75" },
]);

/**
 * Complete CodeMirror theme for the SQL editor
 * Combines editor styling with syntax highlighting
 */
export const sqlTheme: Extension = [editorTheme, syntaxHighlighting(syntaxColors)];

/**
 * Line wrapping extension
 */
export const lineWrapping: Extension = EditorView.lineWrapping;

/**
 * Placeholder extension factory
 */
export function placeholder(text: string): Extension {
  return EditorView.contentAttributes.of({ "aria-label": text });
}
