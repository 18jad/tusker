import { useState, useMemo } from "react";
import {
  History,
  GitCommitHorizontal,
  AlertCircle,
  Loader2,
  Search,
  Plus,
  Pencil,
  Trash2,
  Table2,
  X,
  ChevronDown,
  Database,
} from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useCommitHistory, useCommitDetail } from "../../hooks/useDatabase";
import { ChangeCard } from "../commits/ChangeCard";
import { cn } from "../../lib/utils";
import type { Tab, Row, CommitRecord, CommitChangeRecord } from "../../types";

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

function parseSummaryCounts(summary: string) {
  const inserts = summary.match(/(\d+)\s+insert/i);
  const updates = summary.match(/(\d+)\s+update/i);
  const deletes = summary.match(/(\d+)\s+delete/i);
  return {
    inserts: inserts ? parseInt(inserts[1]) : 0,
    updates: updates ? parseInt(updates[1]) : 0,
    deletes: deletes ? parseInt(deletes[1]) : 0,
  };
}

function parseTablesFromSummary(summary: string): string[] {
  const match = summary.match(/on\s+(.+)$/i);
  if (!match) return [];
  return match[1].split(",").map((t) => t.trim());
}

type ChangeType = "insert" | "update" | "delete";

// ─── Left panel: Commit list sidebar ────────────────────────────────────────

function CommitSidebar({
  commits,
  selectedCommitId,
  onSelect,
  projectName,
  database,
}: {
  commits: CommitRecord[];
  selectedCommitId: string | null;
  onSelect: (id: string) => void;
  projectName?: string;
  database?: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<ChangeType | null>(null);
  const [filterTable, setFilterTable] = useState<string | null>(null);
  const [showTableDropdown, setShowTableDropdown] = useState(false);

  // All tables across all commits
  const allTables = useMemo(() => {
    const set = new Set<string>();
    for (const c of commits) {
      for (const t of parseTablesFromSummary(c.summary)) set.add(t);
    }
    return Array.from(set).sort();
  }, [commits]);

  const filtered = useMemo(() => {
    let result = commits;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.message.toLowerCase().includes(q) ||
          c.summary.toLowerCase().includes(q) ||
          c.id.toLowerCase().startsWith(q)
      );
    }

    if (filterType) {
      result = result.filter((c) => {
        const counts = parseSummaryCounts(c.summary);
        if (filterType === "insert") return counts.inserts > 0;
        if (filterType === "update") return counts.updates > 0;
        if (filterType === "delete") return counts.deletes > 0;
        return true;
      });
    }

    if (filterTable) {
      result = result.filter((c) => {
        const tables = parseTablesFromSummary(c.summary);
        return tables.includes(filterTable);
      });
    }

    return result;
  }, [commits, searchQuery, filterType, filterTable]);

  const hasActiveFilters = filterType !== null || filterTable !== null || searchQuery.trim() !== "";

  return (
    <div className={cn(
      "w-[340px] shrink-0 border-r border-[var(--border-color)]",
      "flex flex-col bg-[var(--bg-primary)]"
    )}>
      {/* Database label + Search + filters */}
      <div className="p-3 space-y-2 border-b border-[var(--border-color)]">
        {projectName && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <Database className="w-3 h-3" />
            <span>{projectName}</span>
            {database && <span className="text-[var(--text-muted)]">· {database}</span>}
          </div>
        )}
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search commits..."
            className={cn(
              "w-full pl-8 pr-8 py-1.5 rounded-md text-xs",
              "bg-[var(--bg-tertiary)] text-[var(--text-primary)]",
              "border border-transparent",
              "placeholder:text-[var(--text-muted)]",
              "focus:outline-none focus:border-[var(--accent-color)]"
            )}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-1.5">
          {/* Type filters */}
          <button
            onClick={() => setFilterType(filterType === "insert" ? null : "insert")}
            className={cn(
              "px-2 py-1 rounded-md text-[11px] font-medium transition-colors",
              filterType === "insert"
                ? "bg-green-500/20 text-green-400 ring-1 ring-green-500/30"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-secondary)]"
            )}
          >
            Inserts
          </button>
          <button
            onClick={() => setFilterType(filterType === "update" ? null : "update")}
            className={cn(
              "px-2 py-1 rounded-md text-[11px] font-medium transition-colors",
              filterType === "update"
                ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-secondary)]"
            )}
          >
            Updates
          </button>
          <button
            onClick={() => setFilterType(filterType === "delete" ? null : "delete")}
            className={cn(
              "px-2 py-1 rounded-md text-[11px] font-medium transition-colors",
              filterType === "delete"
                ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-secondary)]"
            )}
          >
            Deletes
          </button>

          <div className="w-px h-4 bg-[var(--border-color)] mx-0.5" />

          {/* Table filter */}
          <div className="relative">
            <button
              onClick={() => setShowTableDropdown(!showTableDropdown)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors",
                filterTable
                  ? "bg-[var(--accent-color)]/15 text-[var(--accent-color)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-secondary)]"
              )}
            >
              <Table2 className="w-3 h-3" />
              <span className="max-w-[80px] truncate">{filterTable || "Table"}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showTableDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowTableDropdown(false)} />
                <div className={cn(
                  "absolute top-full left-0 mt-1 z-20 min-w-[180px]",
                  "bg-[var(--bg-secondary)] border border-[var(--border-color)]",
                  "rounded-lg shadow-xl shadow-black/30 py-1 max-h-48 overflow-y-auto"
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
                  </button>
                  {allTables.map((table) => (
                    <button
                      key={table}
                      onClick={() => { setFilterTable(table); setShowTableDropdown(false); }}
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-xs font-mono transition-colors",
                        filterTable === table
                          ? "bg-[var(--bg-tertiary)] text-[var(--accent-color)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                      )}
                    >
                      {table}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Clear all filters */}
          {hasActiveFilters && (
            <button
              onClick={() => { setFilterType(null); setFilterTable(null); setSearchQuery(""); }}
              className="ml-auto text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded hover:bg-[var(--bg-tertiary)]"
              title="Clear filters"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="px-3 py-1.5 text-[10px] text-[var(--text-muted)] border-b border-[var(--border-color)] bg-[var(--bg-primary)]">
        {hasActiveFilters
          ? `${filtered.length} of ${commits.length} commits`
          : `${commits.length} commit${commits.length !== 1 ? "s" : ""}`}
      </div>

      {/* Commit list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Search className="w-8 h-8 text-[var(--text-muted)] mb-2" />
            <p className="text-xs text-[var(--text-muted)]">No matching commits</p>
          </div>
        ) : (
          filtered.map((commit) => (
            <CommitListItem
              key={commit.id}
              commit={commit}
              isSelected={selectedCommitId === commit.id}
              onSelect={() => onSelect(commit.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CommitListItem({
  commit,
  isSelected,
  onSelect,
}: {
  commit: CommitRecord;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const counts = parseSummaryCounts(commit.summary);
  const tables = parseTablesFromSummary(commit.summary);

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-[var(--border-color)]",
        "transition-colors duration-100",
        isSelected
          ? "bg-[var(--accent-color)]/8 border-l-2 border-l-[var(--accent-color)]"
          : "border-l-2 border-l-transparent hover:bg-[var(--bg-tertiary)]"
      )}
    >
      {/* Row 1: hash + time */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <GitCommitHorizontal className="w-3 h-3 text-[var(--accent-color)]" />
          <code className="text-[11px] font-mono text-[var(--accent-color)]">
            {commit.id.slice(0, 7)}
          </code>
        </div>
        <span className="text-[10px] text-[var(--text-muted)]" title={formatDate(commit.created_at)}>
          {timeAgo(commit.created_at)}
        </span>
      </div>

      {/* Row 2: message */}
      <p className="text-[13px] text-[var(--text-primary)] truncate mb-1.5">
        {commit.message}
      </p>

      {/* Row 3: compact type counters + tables */}
      <div className="flex items-center gap-1 text-[10px]">
        {counts.inserts > 0 && (
          <span className="text-green-400 font-medium">+{counts.inserts}</span>
        )}
        {counts.updates > 0 && (
          <span className="text-amber-400 font-medium">~{counts.updates}</span>
        )}
        {counts.deletes > 0 && (
          <span className="text-red-400 font-medium">-{counts.deletes}</span>
        )}
        {tables.length > 0 && (
          <>
            <span className="text-[var(--border-color)] mx-0.5">|</span>
            <span className="text-[var(--text-muted)] truncate font-mono">
              {tables.join(", ")}
            </span>
          </>
        )}
      </div>
    </button>
  );
}

// ─── Right panel: Commit detail ─────────────────────────────────────────────

function CommitDetailPanel({
  commitDetail,
  isLoading,
}: {
  commitDetail: { commit: CommitRecord; changes: CommitChangeRecord[] } | undefined;
  isLoading: boolean;
}) {
  const [detailFilterType, setDetailFilterType] = useState<ChangeType | null>(null);
  const [detailFilterTable, setDetailFilterTable] = useState<string | null>(null);

  // Reset filters when commit changes
  const commitId = commitDetail?.commit.id;
  const [lastCommitId, setLastCommitId] = useState<string | undefined>(commitId);
  if (commitId !== lastCommitId) {
    setLastCommitId(commitId);
    setDetailFilterType(null);
    setDetailFilterTable(null);
  }

  const stats = useMemo(() => {
    if (!commitDetail) return null;
    let inserts = 0, updates = 0, deletes = 0;
    const tables = new Set<string>();
    for (const c of commitDetail.changes) {
      if (c.type === "insert") inserts++;
      else if (c.type === "update") updates++;
      else if (c.type === "delete") deletes++;
      tables.add(`${c.schema_name}.${c.table_name}`);
    }
    return { inserts, updates, deletes, tables: Array.from(tables).sort() };
  }, [commitDetail]);

  const filteredChanges = useMemo(() => {
    if (!commitDetail) return [];
    let result = commitDetail.changes;
    if (detailFilterType) {
      result = result.filter((c) => c.type === detailFilterType);
    }
    if (detailFilterTable) {
      result = result.filter((c) => `${c.schema_name}.${c.table_name}` === detailFilterTable);
    }
    return result;
  }, [commitDetail, detailFilterType, detailFilterTable]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (!commitDetail || !stats) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <GitCommitHorizontal className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-[var(--text-secondary)]">Select a commit to view details</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Click any commit on the left
          </p>
        </div>
      </div>
    );
  }

  const hasDetailFilters = detailFilterType !== null || detailFilterTable !== null;

  return (
    <div className="h-full flex flex-col">
      {/* Commit header - sticky */}
      <div className="shrink-0 px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-base font-semibold text-[var(--text-primary)] leading-tight">
            {commitDetail.commit.message}
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <code className="font-mono text-[var(--accent-color)]">{commitDetail.commit.id.slice(0, 7)}</code>
          <span>·</span>
          <span>{formatDate(commitDetail.commit.created_at)}</span>
          <span>·</span>
          <span>{commitDetail.commit.change_count} change{commitDetail.commit.change_count !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="shrink-0 px-6 py-2.5 border-b border-[var(--border-color)] flex items-center gap-2 bg-[var(--bg-primary)]">
        <span className="text-[11px] text-[var(--text-muted)] mr-1">Filter:</span>

        {/* Type filter counters - these ARE the stats */}
        {stats.inserts > 0 && (
          <button
            onClick={() => setDetailFilterType(detailFilterType === "insert" ? null : "insert")}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors",
              detailFilterType === "insert"
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
            onClick={() => setDetailFilterType(detailFilterType === "update" ? null : "update")}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors",
              detailFilterType === "update"
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
            onClick={() => setDetailFilterType(detailFilterType === "delete" ? null : "delete")}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors",
              detailFilterType === "delete"
                ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]"
            )}
          >
            <Trash2 className="w-3 h-3" />
            <span>{stats.deletes} delete{stats.deletes !== 1 ? "s" : ""}</span>
          </button>
        )}

        {stats.tables.length > 1 && (
          <>
            <div className="w-px h-4 bg-[var(--border-color)]" />
            {stats.tables.map((table) => (
              <button
                key={table}
                onClick={() => setDetailFilterTable(detailFilterTable === table ? null : table)}
                className={cn(
                  "px-2 py-0.5 rounded-md text-[11px] font-mono transition-colors",
                  detailFilterTable === table
                    ? "bg-[var(--accent-color)]/15 text-[var(--accent-color)] ring-1 ring-[var(--accent-color)]/30"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]"
                )}
              >
                {table}
              </button>
            ))}
          </>
        )}

        {hasDetailFilters && (
          <>
            <div className="flex-1" />
            <button
              onClick={() => { setDetailFilterType(null); setDetailFilterTable(null); }}
              className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
            <span className="text-[10px] text-[var(--text-muted)]">
              {filteredChanges.length} of {commitDetail.changes.length}
            </span>
          </>
        )}
      </div>

      {/* Change cards */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl space-y-3">
          {filteredChanges.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-[var(--text-muted)]">No changes match the current filter</p>
            </div>
          ) : (
            filteredChanges.map((change) => {
              let data: Row;
              let originalData: Row | undefined;
              try { data = JSON.parse(change.data); } catch { data = {}; }
              try { originalData = change.original_data ? JSON.parse(change.original_data) : undefined; } catch { originalData = undefined; }

              return (
                <ChangeCard
                  key={change.id}
                  type={change.type}
                  schema={change.schema_name}
                  table={change.table_name}
                  data={data}
                  originalData={originalData}
                  sql={change.sql}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function CommitHistoryTab({ tab }: { tab: Tab }) {
  const project = useProjectStore((s) => s.getProject(tab.projectId));
  const { data: commits, isLoading, error } = useCommitHistory(tab.projectId);
  const [selectedCommitId, setSelectedCommitId] = useState<string | null>(null);

  const { data: commitDetail, isLoading: detailLoading } = useCommitDetail(tab.projectId, selectedCommitId);

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-[var(--text-secondary)]">No project selected</p>
          <p className="text-sm text-[var(--text-muted)]">Connect to a database to view commit history</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-400">Failed to load commit history</p>
          <p className="text-sm text-[var(--text-muted)]">{String(error)}</p>
        </div>
      </div>
    );
  }

  if (!commits || commits.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <History className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-[var(--text-secondary)]">No commits yet</p>
          <p className="text-sm text-[var(--text-muted)]">
            Your commit history will appear here after your first commit
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      <CommitSidebar
        commits={commits}
        selectedCommitId={selectedCommitId}
        onSelect={setSelectedCommitId}
        projectName={project?.name}
        database={project?.connection.database}
      />
      <div className="flex-1 bg-[var(--bg-primary)]">
        <CommitDetailPanel
          commitDetail={commitDetail}
          isLoading={detailLoading}
        />
      </div>
    </div>
  );
}
