import { useState, useCallback, useRef } from "react";
import { format } from "sql-formatter";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { SQLEditor, type SQLEditorHandle } from "../query/SQLEditor";
import { QueryResults } from "../query/QueryResults";
import { QueryToolbar } from "../query/QueryToolbar";
import { SavedQueriesPanel } from "../query/SavedQueriesPanel";
import { useQueryStore } from "../../stores/queryStore";
import { useUIStore } from "../../stores/uiStore";
import { getCurrentConnectionId } from "../../hooks/useDatabase";
import { cn } from "../../lib/utils";
import type { Tab, Row, Column } from "../../types";

interface QueryResult {
  rows: Row[];
  columns: Column[];
  rowsAffected?: number;
  executionTime: number;
}

interface ExecuteQueryResponse {
  rows: Row[];
  columns?: { name: string; data_type: string }[];
  rows_affected?: number;
}

interface QueryTabProps {
  tab: Tab;
}

export function QueryTab({ tab }: QueryTabProps) {
  // Query state
  const [sql, setSql] = useState(tab.queryContent || "");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Panel state
  const [showSavedQueries, setShowSavedQueries] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Resize state
  const [editorHeight, setEditorHeight] = useState(250);
  const [isDragging, setIsDragging] = useState(false);

  // Save modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");

  // Refs
  const editorRef = useRef<SQLEditorHandle>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Store actions
  const addToHistory = useQueryStore((state) => state.addToHistory);
  const saveQuery = useQueryStore((state) => state.saveQuery);
  const updateTab = useUIStore((state) => state.updateTab);
  const showToast = useUIStore((state) => state.showToast);

  // Execute query
  const executeQuery = useCallback(async (queryToExecute: string) => {
    const trimmedQuery = queryToExecute.trim();
    if (!trimmedQuery) return;

    const connectionId = getCurrentConnectionId();
    if (!connectionId) {
      setError("Not connected to a database");
      return;
    }

    setIsExecuting(true);
    setError(null);
    setResult(null);

    const startTime = performance.now();

    try {
      const response = await invoke<ExecuteQueryResponse>("execute_query", {
        connectionId,
        sql: trimmedQuery,
      });

      const executionTime = Math.round(performance.now() - startTime);

      // Determine if this was a SELECT or mutation
      const isSelect = trimmedQuery.toUpperCase().trim().startsWith("SELECT") ||
                       trimmedQuery.toUpperCase().trim().startsWith("WITH") ||
                       trimmedQuery.toUpperCase().trim().startsWith("TABLE") ||
                       trimmedQuery.toUpperCase().trim().startsWith("VALUES");

      const columns: Column[] = response.columns?.map((c) => ({
        name: c.name,
        dataType: c.data_type,
        isNullable: true,
        isPrimaryKey: false,
        isForeignKey: false,
      })) ?? [];

      const queryResult: QueryResult = {
        rows: response.rows ?? [],
        columns,
        rowsAffected: isSelect ? undefined : (response.rows_affected ?? response.rows?.length ?? 0),
        executionTime,
      };

      setResult(queryResult);
      addToHistory(trimmedQuery, true, executionTime, response.rows?.length);
    } catch (err) {
      const errorMessage = err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null
          ? (err as Record<string, unknown>).message ?? JSON.stringify(err)
          : String(err);
      setError(errorMessage as string);
      addToHistory(trimmedQuery, false);
    } finally {
      setIsExecuting(false);
    }
  }, [addToHistory]);

  // Handle execute button
  const handleExecute = useCallback(() => {
    executeQuery(sql);
  }, [executeQuery, sql]);

  // Handle execute selection
  const handleExecuteSelection = useCallback(() => {
    const selection = editorRef.current?.getSelection();
    if (selection) {
      executeQuery(selection);
    }
  }, [executeQuery]);

  // Format SQL
  const handleFormat = useCallback(() => {
    try {
      const formatted = format(sql, {
        language: "postgresql",
        tabWidth: 2,
        keywordCase: "upper",
        linesBetweenQueries: 2,
      });
      setSql(formatted);
      updateTab(tab.id, { queryContent: formatted });
    } catch {
      // If formatting fails, keep original
    }
  }, [sql, tab.id, updateTab]);

  // Save query
  const handleSave = useCallback(() => {
    if (!sql.trim()) {
      showToast("Nothing to save", "error");
      return;
    }
    setShowSaveModal(true);
  }, [sql, showToast]);

  const handleSaveConfirm = useCallback(() => {
    if (!saveName.trim()) {
      showToast("Please enter a name", "error");
      return;
    }

    saveQuery({
      name: saveName.trim(),
      sql: sql.trim(),
      description: saveDescription.trim() || undefined,
    });

    showToast("Query saved");
    setShowSaveModal(false);
    setSaveName("");
    setSaveDescription("");
  }, [saveName, saveDescription, sql, saveQuery, showToast]);

  // Load query from saved/history
  const handleLoadQuery = useCallback((loadedSql: string) => {
    setSql(loadedSql);
    updateTab(tab.id, { queryContent: loadedSql });
    setShowSavedQueries(false);
    setShowHistory(false);
  }, [tab.id, updateTab]);

  // Export results
  const handleExport = useCallback(async (exportFormat: "csv" | "json") => {
    if (!result || result.rows.length === 0) return;

    const extension = exportFormat === "csv" ? "csv" : "json";
    const defaultName = `query-results-${Date.now()}.${extension}`;

    const filePath = await save({
      defaultPath: defaultName,
      filters: [
        exportFormat === "csv"
          ? { name: "CSV Files", extensions: ["csv"] }
          : { name: "JSON Files", extensions: ["json"] },
      ],
    });

    if (!filePath) return;

    try {
      let content: string;

      if (exportFormat === "csv") {
        const columnNames = result.columns.length > 0
          ? result.columns.map((c) => c.name)
          : Object.keys(result.rows[0] || {});

        const header = columnNames.map((name) => `"${name}"`).join(",");
        const rows = result.rows.map((row) =>
          columnNames.map((name) => {
            const value = row[name];
            if (value === null) return "";
            if (typeof value === "string") return `"${value.replace(/"/g, '""')}"`;
            if (typeof value === "object") return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
            return String(value);
          }).join(",")
        );

        content = [header, ...rows].join("\n");
      } else {
        content = JSON.stringify(result.rows, null, 2);
      }

      await writeTextFile(filePath, content);
      showToast(`Exported ${result.rows.length} rows`);
    } catch (err) {
      showToast("Failed to export: " + (err instanceof Error ? err.message : String(err)), "error");
    }
  }, [result, showToast]);

  // Handle resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const startY = e.clientY;
    const startHeight = editorHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientY - startY;
      const containerHeight = containerRef.current?.clientHeight ?? 600;
      const newHeight = Math.max(100, Math.min(containerHeight - 150, startHeight + delta));
      setEditorHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [editorHeight]);

  // Update SQL and track selection
  const handleSqlChange = useCallback((value: string) => {
    setSql(value);
    updateTab(tab.id, { queryContent: value });
  }, [tab.id, updateTab]);

  // Panel to show
  const panelMode = showSavedQueries ? "saved" : showHistory ? "history" : null;

  return (
    <div ref={containerRef} className="h-full flex bg-[var(--bg-primary)]">
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <QueryToolbar
          onExecute={handleExecute}
          onExecuteSelection={handleExecuteSelection}
          onFormat={handleFormat}
          onSave={handleSave}
          onToggleSavedQueries={() => {
            setShowSavedQueries(!showSavedQueries);
            setShowHistory(false);
          }}
          onToggleHistory={() => {
            setShowHistory(!showHistory);
            setShowSavedQueries(false);
          }}
          isExecuting={isExecuting}
          hasSelection={true}
          showSavedQueries={showSavedQueries}
          showHistory={showHistory}
        />

        {/* Editor */}
        <div
          ref={editorContainerRef}
          style={{ height: editorHeight }}
          className="shrink-0 border-b border-[var(--border-color)]"
        >
          <SQLEditor
            ref={editorRef}
            value={sql}
            onChange={handleSqlChange}
            onExecute={handleExecute}
            onExecuteSelection={handleExecuteSelection}
            onFormat={handleFormat}
            onSave={handleSave}
          />
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleResizeStart}
          className={cn(
            "h-1.5 cursor-row-resize hover:bg-[var(--accent)]/50 transition-colors shrink-0 bg-[var(--bg-secondary)]",
            isDragging && "bg-[var(--accent)]"
          )}
        />

        {/* Results */}
        <div className="flex-1 min-h-0 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <QueryResults
            result={result}
            error={error}
            isLoading={isExecuting}
            onExport={handleExport}
          />
        </div>
      </div>

      {/* Side panel */}
      {panelMode && (
        <SavedQueriesPanel
          mode={panelMode}
          onSelect={handleLoadQuery}
          onClose={() => {
            setShowSavedQueries(false);
            setShowHistory(false);
          }}
        />
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[var(--bg-secondary)] rounded-lg shadow-xl border border-[var(--border-color)] w-96 max-w-[90vw]">
            <div className="px-4 py-3 border-b border-[var(--border-color)]">
              <h3 className="text-base font-medium text-[var(--text-primary)]">
                Save Query
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1.5">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="My Query"
                  autoFocus
                  className={cn(
                    "w-full h-9 px-3 rounded text-sm",
                    "bg-[var(--bg-primary)] text-[var(--text-primary)]",
                    "border border-[var(--border-color)]",
                    "focus:border-[var(--accent)] focus:outline-none",
                    "placeholder:text-[var(--text-muted)]"
                  )}
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1.5">
                  Description
                </label>
                <textarea
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={2}
                  className={cn(
                    "w-full px-3 py-2 rounded text-sm resize-none",
                    "bg-[var(--bg-primary)] text-[var(--text-primary)]",
                    "border border-[var(--border-color)]",
                    "focus:border-[var(--accent)] focus:outline-none",
                    "placeholder:text-[var(--text-muted)]"
                  )}
                />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-[var(--border-color)] flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setSaveName("");
                  setSaveDescription("");
                }}
                className={cn(
                  "px-4 py-1.5 rounded text-sm",
                  "bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)]",
                  "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                  "transition-colors"
                )}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfirm}
                disabled={!saveName.trim()}
                className={cn(
                  "px-4 py-1.5 rounded text-sm",
                  "bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-white",
                  "transition-colors",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
