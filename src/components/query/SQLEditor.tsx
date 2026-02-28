import { useRef, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  bracketMatching,
  indentOnInput,
  foldGutter,
  foldKeymap,
} from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { sqlTheme } from "../../lib/codemirrorTheme";
import { modKeyName } from "../../lib/utils";
import { useProjectStore } from "../../stores/projectStore";
import { useUIStore } from "../../stores/uiStore";
import type { Schema } from "../../types";

const EMPTY_SCHEMAS: Schema[] = [];

interface SQLEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute?: () => void;
  onExecuteSelection?: () => void;
  onFormat?: () => void;
  onSave?: () => void;
  readOnly?: boolean;
  placeholderText?: string;
}

export interface SQLEditorHandle {
  getSelection: () => string;
}

export const SQLEditor = forwardRef<SQLEditorHandle, SQLEditorProps>(function SQLEditor({
  value,
  onChange,
  onExecute,
  onExecuteSelection,
  onFormat,
  onSave,
  readOnly = false,
  placeholderText = `-- Write your SQL query here... (${modKeyName}+Enter to execute)`,
}, ref) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const schemaCompartment = useRef(new Compartment());
  const readOnlyCompartment = useRef(new Compartment());

  // Store callbacks in refs so keymap always has access to latest versions
  const onExecuteRef = useRef(onExecute);
  const onExecuteSelectionRef = useRef(onExecuteSelection);
  const onFormatRef = useRef(onFormat);
  const onSaveRef = useRef(onSave);

  // Keep refs updated
  useEffect(() => {
    onExecuteRef.current = onExecute;
    onExecuteSelectionRef.current = onExecuteSelection;
    onFormatRef.current = onFormat;
    onSaveRef.current = onSave;
  }, [onExecute, onExecuteSelection, onFormat, onSave]);

  // Get schemas for autocomplete from the active connection
  const activeProjectId = useUIStore.getState().getActiveProjectId();
  const schemas = useProjectStore((state) =>
    activeProjectId ? state.connections[activeProjectId]?.schemas ?? EMPTY_SCHEMAS : EMPTY_SCHEMAS
  );

  // Build schema map for autocomplete
  const schemaMap = useMemo(() => {
    const result: Record<string, string[]> = {};

    schemas.forEach((s) => {
      s.tables.forEach((t) => {
        // Add with schema prefix
        result[`${s.name}.${t.name}`] = t.columns?.map((c) => c.name) ?? [];
        // Add without prefix for convenience
        if (!result[t.name]) {
          result[t.name] = t.columns?.map((c) => c.name) ?? [];
        }
      });
    });

    return result;
  }, [schemas]);

  // Create keyboard shortcuts - use refs so callbacks are always current
  const customKeymap = useMemo(
    () =>
      keymap.of([
        {
          key: "Mod-Enter",
          run: () => {
            onExecuteRef.current?.();
            return true;
          },
        },
        {
          key: "Mod-Shift-Enter",
          run: () => {
            onExecuteSelectionRef.current?.();
            return true;
          },
        },
        {
          key: "Mod-Shift-f",
          run: () => {
            onFormatRef.current?.();
            return true;
          },
        },
        {
          key: "Mod-s",
          run: () => {
            onSaveRef.current?.();
            return true;
          },
          preventDefault: true,
        },
      ]),
    [] // No dependencies needed - refs are stable
  );

  // Initialize editor
  useEffect(() => {
    if (!editorRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        foldGutter(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        highlightSelectionMatches(),
        autocompletion({
          defaultKeymap: true,
          maxRenderedOptions: 30,
          icons: true,
        }),
        schemaCompartment.current.of(
          sql({
            dialect: PostgreSQL,
            schema: schemaMap,
            upperCaseKeywords: true,
          })
        ),
        readOnlyCompartment.current.of(EditorState.readOnly.of(readOnly)),
        sqlTheme,
        customKeymap,
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          ...closeBracketsKeymap,
          ...searchKeymap,
          ...foldKeymap,
        ]),
        placeholder(placeholderText),
        updateListener,
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only re-create editor on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update schema autocomplete when schemas change
  useEffect(() => {
    if (!viewRef.current) return;

    viewRef.current.dispatch({
      effects: schemaCompartment.current.reconfigure(
        sql({
          dialect: PostgreSQL,
          schema: schemaMap,
          upperCaseKeywords: true,
        })
      ),
    });
  }, [schemaMap]);

  // Update readOnly state
  useEffect(() => {
    if (!viewRef.current) return;

    viewRef.current.dispatch({
      effects: readOnlyCompartment.current.reconfigure(
        EditorState.readOnly.of(readOnly)
      ),
    });
  }, [readOnly]);

  // Sync external value changes
  useEffect(() => {
    if (!viewRef.current) return;
    const currentValue = viewRef.current.state.doc.toString();
    if (value !== currentValue) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value,
        },
      });
    }
  }, [value]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getSelection: () => {
      if (!viewRef.current) return "";
      const { from, to } = viewRef.current.state.selection.main;
      if (from === to) return "";
      return viewRef.current.state.doc.sliceString(from, to);
    },
  }), []);

  return (
    <div
      ref={editorRef}
      className="h-full w-full overflow-hidden [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto"
    />
  );
});
