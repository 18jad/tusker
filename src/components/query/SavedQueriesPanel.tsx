import { useState } from "react";
import {
  X,
  Search,
  FileCode,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
} from "lucide-react";
import { cn, formatRelativeTime } from "../../lib/utils";
import { useQueryStore, type SavedQuery, type QueryHistoryItem } from "../../stores/queryStore";

interface SavedQueriesPanelProps {
  mode: "saved" | "history";
  onSelect: (sql: string) => void;
  onClose: () => void;
}

export function SavedQueriesPanel({
  mode,
  onSelect,
  onClose,
}: SavedQueriesPanelProps) {
  const [search, setSearch] = useState("");
  const savedQueries = useQueryStore((state) => state.savedQueries);
  const queryHistory = useQueryStore((state) => state.queryHistory);
  const deleteQuery = useQueryStore((state) => state.deleteQuery);
  const clearHistory = useQueryStore((state) => state.clearHistory);

  const title = mode === "saved" ? "Saved Queries" : "Query History";
  const items = mode === "saved" ? savedQueries : queryHistory;

  // Filter items by search
  const filteredItems = items.filter((item) => {
    const searchLower = search.toLowerCase();
    if ("name" in item) {
      return (
        item.name.toLowerCase().includes(searchLower) ||
        item.sql.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower)
      );
    }
    return item.sql.toLowerCase().includes(searchLower);
  });

  return (
    <div className="w-72 h-full flex flex-col border-l border-[var(--border-color)] bg-[var(--bg-secondary)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)]">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">{title}</h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-[var(--border-color)]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className={cn(
              "w-full h-8 pl-8 pr-3 rounded text-sm",
              "bg-[var(--bg-primary)] text-[var(--text-primary)]",
              "border border-[var(--border-color)]",
              "focus:border-[var(--accent)] focus:outline-none",
              "placeholder:text-[var(--text-muted)]"
            )}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="p-4 text-center text-[var(--text-muted)] text-sm">
            {search
              ? "No matching queries found"
              : mode === "saved"
                ? "No saved queries yet"
                : "No query history yet"}
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-color)]">
            {filteredItems.map((item) =>
              mode === "saved" ? (
                <SavedQueryItem
                  key={item.id}
                  query={item as SavedQuery}
                  onSelect={onSelect}
                  onDelete={deleteQuery}
                />
              ) : (
                <HistoryItem
                  key={item.id}
                  item={item as QueryHistoryItem}
                  onSelect={onSelect}
                />
              )
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {mode === "history" && queryHistory.length > 0 && (
        <div className="p-2 border-t border-[var(--border-color)]">
          <button
            onClick={clearHistory}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded text-sm",
              "text-red-400 hover:bg-red-500/10",
              "transition-colors"
            )}
          >
            <Trash2 className="w-4 h-4" />
            Clear History
          </button>
        </div>
      )}
    </div>
  );
}

interface SavedQueryItemProps {
  query: SavedQuery;
  onSelect: (sql: string) => void;
  onDelete: (id: string) => void;
}

function SavedQueryItem({ query, onSelect, onDelete }: SavedQueryItemProps) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="group">
      <div
        className={cn(
          "flex items-start gap-2 px-3 py-2 cursor-pointer",
          "hover:bg-[var(--bg-tertiary)] transition-colors"
        )}
        onClick={() => onSelect(query.sql)}
      >
        <FileCode className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)] truncate">
              {query.name}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(query.id);
              }}
              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          {query.description && (
            <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
              {query.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-[var(--text-muted)]">
              {formatRelativeTime(query.updatedAt)}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPreview(!showPreview);
              }}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-0.5"
            >
              <ChevronRight
                className={cn(
                  "w-3 h-3 transition-transform",
                  showPreview && "rotate-90"
                )}
              />
              Preview
            </button>
          </div>
        </div>
      </div>
      {showPreview && (
        <div className="px-3 pb-2">
          <pre className="text-xs text-[var(--text-secondary)] bg-[var(--bg-primary)] p-2 rounded border border-[var(--border-color)] overflow-x-auto max-h-24">
            {query.sql}
          </pre>
        </div>
      )}
    </div>
  );
}

interface HistoryItemProps {
  item: QueryHistoryItem;
  onSelect: (sql: string) => void;
}

function HistoryItem({ item, onSelect }: HistoryItemProps) {
  const [showPreview, setShowPreview] = useState(false);

  // Truncate SQL for display
  const displaySql = item.sql.length > 60 ? item.sql.substring(0, 60) + "..." : item.sql;

  return (
    <div className="group">
      <div
        className={cn(
          "flex items-start gap-2 px-3 py-2 cursor-pointer",
          "hover:bg-[var(--bg-tertiary)] transition-colors"
        )}
        onClick={() => onSelect(item.sql)}
      >
        {item.success ? (
          <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
        ) : (
          <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono text-[var(--text-secondary)] truncate">
            {displaySql.replace(/\s+/g, " ")}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(item.timestamp)}
            </span>
            {item.executionTime !== undefined && (
              <span>{item.executionTime}ms</span>
            )}
            {item.rowCount !== undefined && (
              <span>{item.rowCount} rows</span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPreview(!showPreview);
              }}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-0.5"
            >
              <ChevronRight
                className={cn(
                  "w-3 h-3 transition-transform",
                  showPreview && "rotate-90"
                )}
              />
              Full
            </button>
          </div>
        </div>
      </div>
      {showPreview && (
        <div className="px-3 pb-2">
          <pre className="text-xs text-[var(--text-secondary)] bg-[var(--bg-primary)] p-2 rounded border border-[var(--border-color)] overflow-x-auto max-h-32 whitespace-pre-wrap">
            {item.sql}
          </pre>
        </div>
      )}
    </div>
  );
}
