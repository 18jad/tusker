import { useEffect, useRef, useState, useMemo } from "react";
import {
  Trash2,
  Play,
  AlertCircle,
  Loader2,
  MessageSquare,
  FileEdit,
  Plus,
  Pencil,
  X,
  ChevronDown,
  Table2,
} from "lucide-react";
import { Button } from "../ui/Button";
import { useChangesStore } from "../../stores/changesStore";
import { useProjectStore } from "../../stores/projectStore";
import { useUIStore } from "../../stores/uiStore";
import { useCommitChanges, useSaveCommit } from "../../hooks/useDatabase";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "../../lib/utils";
import { ChangeCard } from "../commits/ChangeCard";
import type { StagedChange, Tab } from "../../types";

type ChangeType = "insert" | "update" | "delete";

function generateSummary(changes: StagedChange[]): string {
  const counts: Record<string, number> = {};
  const tables = new Set<string>();
  for (const c of changes) {
    counts[c.type] = (counts[c.type] || 0) + 1;
    tables.add(`${c.schema}.${c.table}`);
  }
  const parts: string[] = [];
  if (counts.insert) parts.push(`${counts.insert} insert${counts.insert > 1 ? "s" : ""}`);
  if (counts.update) parts.push(`${counts.update} update${counts.update > 1 ? "s" : ""}`);
  if (counts.delete) parts.push(`${counts.delete} delete${counts.delete > 1 ? "s" : ""}`);
  return `${parts.join(", ")} on ${Array.from(tables).join(", ")}`;
}

export function StagedChangesTab({ tab: _tab }: { tab: Tab }) {
  const { showToast } = useUIStore();
  const { changes, removeChange, clearChanges } = useChangesStore();
  const activeProjectId = useUIStore.getState().getActiveProjectId();
  const activeProject = useProjectStore((s) => activeProjectId ? s.getProject(activeProjectId) : undefined);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [showCommitInput, setShowCommitInput] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const messageInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [filterType, setFilterType] = useState<ChangeType | null>(null);
  const [filterTable, setFilterTable] = useState<string | null>(null);
  const [showTableDropdown, setShowTableDropdown] = useState(false);

  const commitChanges = useCommitChanges();
  const saveCommit = useSaveCommit();
  const queryClient = useQueryClient();

  const stats = useMemo(() => {
    let inserts = 0, updates = 0, deletes = 0;
    const tables = new Set<string>();
    for (const c of changes) {
      if (c.type === "insert") inserts++;
      else if (c.type === "update") updates++;
      else if (c.type === "delete") deletes++;
      tables.add(`${c.schema}.${c.table}`);
    }
    return { inserts, updates, deletes, tables: Array.from(tables).sort() };
  }, [changes]);

  const filteredChanges = useMemo(() => {
    let result = changes;
    if (filterType) {
      result = result.filter((c) => c.type === filterType);
    }
    if (filterTable) {
      result = result.filter((c) => `${c.schema}.${c.table}` === filterTable);
    }
    return result;
  }, [changes, filterType, filterTable]);

  const hasActiveFilters = filterType !== null || filterTable !== null;

  useEffect(() => {
    if (showCommitInput && messageInputRef.current) {
      messageInputRef.current.focus();
    }
  }, [showCommitInput]);

  const summary = generateSummary(changes);

  const handleCommitClick = () => {
    setShowCommitInput(true);
    setCommitError(null);
  };

  const handleCommitConfirm = async () => {
    setCommitError(null);
    const queries = changes.map((c) => c.sql);
    const finalMessage = commitMessage.trim() || summary;

    try {
      const connectionId = useUIStore.getState().getActiveConnectionId();
      if (!connectionId) throw new Error("No active connection");
      await commitChanges.mutateAsync({ connectionId, queries });

      if (activeProject) {
        try {
          await saveCommit.mutateAsync({
            projectId: activeProject.id,
            message: finalMessage,
            summary,
            changes: changes.map((c) => ({
              type: c.type,
              schema_name: c.schema,
              table_name: c.table,
              data: JSON.stringify(c.data),
              original_data: c.originalData ? JSON.stringify(c.originalData) : null,
              sql: c.sql,
            })),
          });
          queryClient.invalidateQueries({ queryKey: ["commitHistory"] });
        } catch {
          console.error("Failed to save commit to history");
        }
      }

      clearChanges();
      setShowCommitInput(false);
      setCommitMessage("");
      setFilterType(null);
      setFilterTable(null);
      showToast(`Committed ${changes.length} change${changes.length !== 1 ? "s" : ""}`, "success");
    } catch (err) {
      let errorMessage: string;
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "string") {
        errorMessage = err;
      } else if (typeof err === "object" && err !== null) {
        const errObj = err as Record<string, unknown>;
        errorMessage = (errObj.message || errObj.error || errObj.description || JSON.stringify(err, null, 2)) as string;
      } else {
        errorMessage = "Failed to commit changes";
      }
      setCommitError(errorMessage);
    }
  };

  const handleCommitCancel = () => {
    setShowCommitInput(false);
    setCommitMessage("");
    setCommitError(null);
  };

  const handleDiscardAll = () => {
    clearChanges();
    setCommitError(null);
    setShowCommitInput(false);
    setCommitMessage("");
    setFilterType(null);
    setFilterTable(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCommitConfirm();
    }
  };

  const isPending = commitChanges.isPending || saveCommit.isPending;

  if (changes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <FileEdit className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-[var(--text-secondary)]">No staged changes</p>
          <p className="text-sm text-[var(--text-muted)]">
            Your changes will appear here before committing
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Top bar: commit actions */}
      <div className="shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <div className="px-6 py-3">
          {commitError && (
            <div className="mb-3 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm max-h-32 overflow-y-auto">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <pre className="whitespace-pre-wrap break-words font-mono text-xs flex-1">{commitError}</pre>
              </div>
            </div>
          )}

          {showCommitInput ? (
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <label className="text-xs font-medium text-[var(--text-secondary)]">Commit message</label>
                </div>
                <input
                  ref={messageInputRef}
                  type="text"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe your changes (optional)"
                  disabled={isPending}
                  className={cn(
                    "w-full px-3 py-2 rounded-md text-sm",
                    "bg-[var(--bg-primary)] text-[var(--text-primary)]",
                    "border border-[var(--border-color)]",
                    "placeholder:text-[var(--text-muted)]",
                    "focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]",
                    "disabled:opacity-50"
                  )}
                />
                <p className="mt-1 text-xs text-[var(--text-muted)]">{summary}</p>
              </div>
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={handleCommitCancel} disabled={isPending}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleCommitConfirm}
                  disabled={isPending}
                  iconLeft={isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                >
                  {isPending ? "Committing..." : "Commit"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-primary)]">
                {changes.length} staged change{changes.length !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDiscardAll}
                  disabled={isPending}
                  iconLeft={<Trash2 className="w-4 h-4" />}
                >
                  Discard All
                </Button>
                <Button
                  variant="primary"
                  onClick={handleCommitClick}
                  disabled={isPending}
                  iconLeft={<Play className="w-4 h-4" />}
                >
                  Commit Changes
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="shrink-0 px-6 py-2.5 border-b border-[var(--border-color)] flex items-center gap-2 bg-[var(--bg-primary)]">
        <span className="text-[11px] text-[var(--text-muted)] mr-1">Show:</span>

        {/* Type filters - doubles as stats display */}
        {stats.inserts > 0 && (
          <button
            onClick={() => setFilterType(filterType === "insert" ? null : "insert")}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors",
              filterType === "insert"
                ? "bg-green-500/20 text-green-400 ring-1 ring-green-500/30"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]"
            )}
          >
            <Plus className="w-3 h-3" />
            <span>{stats.inserts} insert{stats.inserts !== 1 ? "s" : ""}</span>
          </button>
        )}
        {stats.updates > 0 && (
          <button
            onClick={() => setFilterType(filterType === "update" ? null : "update")}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors",
              filterType === "update"
                ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]"
            )}
          >
            <Pencil className="w-3 h-3" />
            <span>{stats.updates} update{stats.updates !== 1 ? "s" : ""}</span>
          </button>
        )}
        {stats.deletes > 0 && (
          <button
            onClick={() => setFilterType(filterType === "delete" ? null : "delete")}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors",
              filterType === "delete"
                ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]"
            )}
          >
            <Trash2 className="w-3 h-3" />
            <span>{stats.deletes} delete{stats.deletes !== 1 ? "s" : ""}</span>
          </button>
        )}

        {/* Table select dropdown */}
        <div className="w-px h-4 bg-[var(--border-color)]" />
        <div className="relative">
          <button
            onClick={() => setShowTableDropdown(!showTableDropdown)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors",
              filterTable
                ? "bg-[var(--accent-color)]/15 text-[var(--accent-color)] ring-1 ring-[var(--accent-color)]/30"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]"
            )}
          >
            <Table2 className="w-3 h-3" />
            <span className="max-w-[140px] truncate font-mono">
              {filterTable || "All tables"}
            </span>
            <ChevronDown className={cn("w-3 h-3 transition-transform", showTableDropdown && "rotate-180")} />
          </button>
          {showTableDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowTableDropdown(false)} />
              <div className={cn(
                "absolute top-full left-0 mt-1 z-20 min-w-[200px]",
                "bg-[var(--bg-secondary)] border border-[var(--border-color)]",
                "rounded-lg shadow-xl shadow-black/30 py-1 max-h-60 overflow-y-auto"
              )}>
                <button
                  onClick={() => { setFilterTable(null); setShowTableDropdown(false); }}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-xs transition-colors",
                    !filterTable
                      ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                  )}
                >
                  All tables
                  {!filterTable && <span className="ml-2 text-[var(--text-muted)]">({changes.length})</span>}
                </button>
                {stats.tables.map((table) => {
                  const count = changes.filter((c) => `${c.schema}.${c.table}` === table).length;
                  return (
                    <button
                      key={table}
                      onClick={() => { setFilterTable(table); setShowTableDropdown(false); }}
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-xs font-mono transition-colors flex items-center justify-between",
                        filterTable === table
                          ? "bg-[var(--bg-tertiary)] text-[var(--accent-color)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                      )}
                    >
                      <span>{table}</span>
                      <span className="text-[var(--text-muted)] font-sans">{count}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Clear + count */}
        {hasActiveFilters && (
          <>
            <div className="flex-1" />
            <button
              onClick={() => { setFilterType(null); setFilterTable(null); }}
              className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
            <span className="text-[10px] text-[var(--text-muted)]">
              {filteredChanges.length} of {changes.length}
            </span>
          </>
        )}
      </div>

      {/* Changes list */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-3">
          {filteredChanges.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-[var(--text-muted)]">No changes match the current filter</p>
            </div>
          ) : (
            filteredChanges.map((change) => (
              <ChangeCard
                key={change.id}
                type={change.type}
                schema={change.schema}
                table={change.table}
                data={change.data}
                originalData={change.originalData}
                sql={change.sql}
                onRemove={() => removeChange(change.id)}
                collapsible
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
