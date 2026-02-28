import { useState, useRef, useEffect } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Plus, X } from "lucide-react";
import { cn } from "../../lib/utils";
import type { Column, SortColumn } from "../../types";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../ui/Select";

/** Local draft rule — column can be "" when user hasn't picked yet */
interface DraftSort {
  column: string;
  direction: "ASC" | "DESC";
}

interface SortPopoverProps {
  columns: Column[];
  sorts: SortColumn[];
  onSortsChange: (sorts: SortColumn[]) => void;
}

export function SortPopover({ columns, sorts, onSortsChange }: SortPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Local draft state that may include rows with column=""
  const [drafts, setDrafts] = useState<DraftSort[]>(sorts);

  // Sync drafts when external sorts change (e.g. header click)
  useEffect(() => {
    setDrafts(sorts);
  }, [sorts]);

  // Propagate only valid (non-empty column) drafts to parent
  const commitDrafts = (next: DraftSort[]) => {
    setDrafts(next);
    const valid = next.filter((d) => d.column !== "");
    onSortsChange(valid as SortColumn[]);
  };

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      // Ignore clicks inside portaled Radix Select dropdowns
      if (target?.closest?.("[data-radix-popper-content-wrapper]")) return;

      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        // On close, drop any draft rows that still have no column picked
        setDrafts((prev) => prev.filter((d) => d.column !== ""));
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrafts((prev) => prev.filter((d) => d.column !== ""));
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const addSortRule = () => {
    // Add a blank draft row — user must pick the column
    setDrafts((prev) => [...prev, { column: "", direction: "ASC" }]);
  };

  const removeSortRule = (index: number) => {
    const next = drafts.filter((_, i) => i !== index);
    commitDrafts(next);
  };

  const updateSortColumn = (index: number, column: string) => {
    const next = drafts.map((d, i) => (i === index ? { ...d, column } : d));
    commitDrafts(next);
  };

  const toggleSortDirection = (index: number) => {
    const next: DraftSort[] = drafts.map((d, i) =>
      i === index ? { ...d, direction: d.direction === "ASC" ? "DESC" as const : "ASC" as const } : d
    );
    commitDrafts(next);
  };

  const clearAll = () => {
    commitDrafts([]);
  };

  const usedColumns = new Set(drafts.map((d) => d.column).filter(Boolean));
  // Can add if there are unused columns AND no pending blank row
  const hasPendingBlank = drafts.some((d) => d.column === "");
  const canAddMore = columns.length > drafts.length && !hasPendingBlank;
  const hasSorts = sorts.length > 0;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] text-xs",
          "transition-colors",
          hasSorts
            ? "text-[var(--accent)] hover:bg-[var(--accent)]/10"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
        )}
        title="Sort rules"
      >
        <ArrowUpDown className="w-3.5 h-3.5" />
        <span>Sort</span>
        {hasSorts && (
          <span className="min-w-[16px] h-4 flex items-center justify-center rounded-full bg-[var(--accent)] text-white text-[10px] font-semibold px-1">
            {sorts.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className={cn(
            "absolute z-[100] right-0 mt-1 w-80",
            "bg-[var(--bg-secondary)] border border-[var(--border-color)]",
            "rounded-[4px] shadow-xl shadow-black/30",
            "animate-in fade-in zoom-in-95 duration-100"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)]">
            <span className="text-xs font-medium text-[var(--text-primary)]">
              Sort by
            </span>
            {hasSorts && (
              <button
                onClick={clearAll}
                className="text-[10px] text-[var(--text-muted)] hover:text-red-400 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Sort rules */}
          <div className="p-2 space-y-1.5 max-h-[240px] overflow-y-auto">
            {drafts.length === 0 && (
              <div className="text-xs text-[var(--text-muted)] text-center py-3">
                No sort rules. Add one below.
              </div>
            )}

            {drafts.map((draft, index) => (
              <div
                key={index}
                className="flex items-center gap-1.5"
              >
                {/* Column select */}
                <Select
                  value={draft.column || undefined}
                  onValueChange={(val) => updateSortColumn(index, val)}
                >
                  <SelectTrigger
                    className={cn(
                      "flex-1 h-7 px-2 text-xs rounded",
                      "bg-[var(--bg-primary)]",
                      draft.column ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]",
                      "border border-[var(--border-color)]",
                      "focus:border-[var(--accent)] focus:outline-none",
                      "cursor-pointer"
                    )}
                  >
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((col) => (
                      <SelectItem
                        key={col.name}
                        value={col.name}
                        disabled={usedColumns.has(col.name) && col.name !== draft.column}
                      >
                        {col.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Direction toggle */}
                <button
                  onClick={() => toggleSortDirection(index)}
                  disabled={!draft.column}
                  className={cn(
                    "flex items-center gap-1 h-7 px-2 rounded text-xs",
                    "bg-[var(--bg-primary)] border border-[var(--border-color)]",
                    "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                    "hover:border-[var(--accent)] transition-colors",
                    "whitespace-nowrap",
                    "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[var(--border-color)]"
                  )}
                  title={draft.direction === "ASC" ? "Ascending" : "Descending"}
                >
                  {draft.direction === "ASC" ? (
                    <>
                      <ArrowUp className="w-3 h-3" />
                      <span>Asc</span>
                    </>
                  ) : (
                    <>
                      <ArrowDown className="w-3 h-3" />
                      <span>Desc</span>
                    </>
                  )}
                </button>

                {/* Remove */}
                <button
                  onClick={() => removeSortRule(index)}
                  className={cn(
                    "flex items-center justify-center w-7 h-7 rounded",
                    "text-[var(--text-muted)] hover:text-red-400",
                    "hover:bg-red-500/10 transition-colors"
                  )}
                  title="Remove sort rule"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Add button */}
          {canAddMore && (
            <div className="px-2 pb-2">
              <button
                onClick={addSortRule}
                className={cn(
                  "w-full flex items-center justify-center gap-1.5 h-7 rounded text-xs",
                  "border border-dashed border-[var(--border-color)]",
                  "text-[var(--text-muted)] hover:text-[var(--accent)]",
                  "hover:border-[var(--accent)]/50 transition-colors"
                )}
              >
                <Plus className="w-3 h-3" />
                Add sort rule
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
