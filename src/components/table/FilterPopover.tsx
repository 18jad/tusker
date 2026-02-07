import { useState, useRef, useEffect, useCallback } from "react";
import { Filter, Plus, X } from "lucide-react";
import { cn } from "../../lib/utils";
import type { Column, FilterCondition, FilterOperator } from "../../types";
import {
  type ColumnCategory,
  type DraftFilter,
  getColumnCategory,
  getFilterChipLabel,
  OPERATORS_BY_CATEGORY,
  TEXT_OPERATORS,
  DEFAULT_OPERATOR,
  NO_VALUE_OPERATORS,
  isValueValid,
  toDrafts,
} from "./filterUtils";

// ---------------------------------------------------------------------------
// DebouncedInput — flush on blur, debounce on change
// ---------------------------------------------------------------------------

function DebouncedInput({
  value,
  onChange,
  type = "text",
  placeholder,
  className,
  invalid = false,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
  invalid?: boolean;
}) {
  const [local, setLocal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const flush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onChange(local);
  }, [local, onChange]);

  const handleChange = (v: string) => {
    setLocal(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), 300);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <input
      type={type}
      value={local}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={flush}
      placeholder={placeholder}
      className={cn(className, invalid && "!border-red-500/60")}
      title={invalid ? "Invalid value for this column type" : undefined}
    />
  );
}

// ---------------------------------------------------------------------------
// FilterButton — toolbar trigger + inline chips
// ---------------------------------------------------------------------------

interface FilterButtonProps {
  columns: Column[];
  filters: FilterCondition[];
  isOpen: boolean;
  onToggle: () => void;
  onRemoveFilter: (index: number) => void;
}

export function FilterButton({ columns, filters, isOpen, onToggle, onRemoveFilter }: FilterButtonProps) {
  const hasFilters = filters.length > 0;
  const MAX_CHIPS = 3;

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs",
          "transition-colors",
          isOpen
            ? "text-[var(--accent)] bg-[var(--accent)]/10"
            : hasFilters
              ? "text-[var(--accent)] hover:bg-[var(--accent)]/10"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]",
        )}
        title="Filter rules"
      >
        <Filter className="w-3.5 h-3.5" />
        <span>Filter</span>
        {hasFilters && !isOpen && (
          <span className="min-w-[16px] h-4 flex items-center justify-center rounded-full bg-[var(--accent)] text-white text-[10px] font-semibold px-1">
            {filters.length}
          </span>
        )}
      </button>

    </div>
  );
}

// ---------------------------------------------------------------------------
// FilterPanel — inline editing panel
// ---------------------------------------------------------------------------

interface FilterPanelProps {
  columns: Column[];
  filters: FilterCondition[];
  onFiltersChange: (filters: FilterCondition[]) => void;
  onClose: () => void;
}

export function FilterPanel({ columns, filters, onFiltersChange, onClose }: FilterPanelProps) {
  const [drafts, setDrafts] = useState<DraftFilter[]>(toDrafts(filters));
  const selfCommitRef = useRef(false);

  // Sync drafts when filters change externally
  useEffect(() => {
    if (selfCommitRef.current) {
      selfCommitRef.current = false;
      return;
    }
    setDrafts(toDrafts(filters));
  }, [filters]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrafts((prev) => prev.filter((d) => d.column !== ""));
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const getCategoryForDraft = useCallback(
    (d: DraftFilter): ColumnCategory => {
      const col = columns.find((c) => c.name === d.column);
      return col ? getColumnCategory(col) : "text";
    },
    [columns],
  );

  const commitDrafts = useCallback(
    (next: DraftFilter[]) => {
      setDrafts(next);
      const valid: FilterCondition[] = next
        .filter((d) => {
          if (!d.column) return false;
          if (NO_VALUE_OPERATORS.includes(d.operator)) return true;
          const cat = getCategoryForDraft(d);
          if (d.operator === "between") {
            return (
              isValueValid(cat, d.operator, d.value) &&
              isValueValid(cat, d.operator, d.value2)
            );
          }
          return isValueValid(cat, d.operator, d.value);
        })
        .map((d) => {
          const fc: FilterCondition = { column: d.column, operator: d.operator };
          if (!NO_VALUE_OPERATORS.includes(d.operator)) {
            fc.value = d.value;
            if (d.operator === "between") fc.value2 = d.value2;
          }
          return fc;
        });
      selfCommitRef.current = true;
      onFiltersChange(valid);
    },
    [onFiltersChange, getCategoryForDraft],
  );

  // ---- Mutations -----------------------------------------------------------

  const addFilterRule = () => {
    setDrafts((prev) => [...prev, { column: "", operator: "contains", value: "", value2: "" }]);
  };

  const removeFilterRule = (index: number) => {
    const next = drafts.filter((_, i) => i !== index);
    commitDrafts(next);
  };

  const updateColumn = (index: number, colName: string) => {
    const col = columns.find((c) => c.name === colName);
    const cat = col ? getColumnCategory(col) : "text";
    const op = DEFAULT_OPERATOR[cat];
    const next = drafts.map((d, i) =>
      i === index ? { ...d, column: colName, operator: op, value: "", value2: "" } : d,
    );
    commitDrafts(next);
  };

  const updateOperator = (index: number, op: FilterOperator) => {
    const next = drafts.map((d, i) => {
      if (i !== index) return d;
      const updated = { ...d, operator: op };
      if (op !== "between") updated.value2 = "";
      return updated;
    });
    commitDrafts(next);
  };

  const updateValue = (index: number, value: string) => {
    const next = drafts.map((d, i) => (i === index ? { ...d, value } : d));
    commitDrafts(next);
  };

  const updateValue2 = (index: number, value2: string) => {
    const next = drafts.map((d, i) => (i === index ? { ...d, value2 } : d));
    commitDrafts(next);
  };

  const clearAll = () => commitDrafts([]);

  // ---- Render helpers -------------------------------------------------------

  const hasPendingBlank = drafts.some((d) => d.column === "");
  const canAddMore = columns.length > 0 && !hasPendingBlank;
  const hasFilters = filters.length > 0;

  const getOperatorsForDraft = (d: DraftFilter) => {
    if (!d.column) return TEXT_OPERATORS;
    const col = columns.find((c) => c.name === d.column);
    const cat = col ? getColumnCategory(col) : "text";
    return OPERATORS_BY_CATEGORY[cat];
  };

  const getColumnForDraft = (d: DraftFilter): Column | undefined =>
    columns.find((c) => c.name === d.column);

  const isValueInvalid = (d: DraftFilter, val: string): boolean => {
    if (!d.column || val === "") return false;
    if (NO_VALUE_OPERATORS.includes(d.operator)) return false;
    return !isValueValid(getCategoryForDraft(d), d.operator, val);
  };

  const inputCls = cn(
    "h-8 px-2 text-xs rounded",
    "bg-[var(--bg-primary)] text-[var(--text-primary)]",
    "border border-[var(--border-color)]",
    "focus:border-[var(--accent)] focus:outline-none",
  );

  return (
    <div
      className={cn(
        "bg-[var(--bg-secondary)] border-b border-[var(--border-color)]",
        "animate-in fade-in-0 slide-in-from-top-2 duration-150",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-color)]">
        <span className="text-xs font-medium text-[var(--text-primary)]">Filter by</span>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="text-[10px] text-[var(--text-muted)] hover:text-red-400 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Rules */}
      <div className="px-4 py-2 space-y-2 max-h-[280px] overflow-y-auto">
        {drafts.length === 0 && (
          <div className="text-xs text-[var(--text-muted)] text-center py-3">
            No filters. Add one below.
          </div>
        )}

        {drafts.map((draft, index) => {
          const operators = getOperatorsForDraft(draft);
          const col = getColumnForDraft(draft);
          const cat = col ? getColumnCategory(col) : "text";
          const needsValue = !NO_VALUE_OPERATORS.includes(draft.operator);
          const isEnum = cat === "enum" && col?.enumValues && col.enumValues.length > 0;
          const isBetween = draft.operator === "between";

          return (
            <div key={index} className="flex items-center gap-2">
              {/* Column select */}
              <select
                value={draft.column}
                onChange={(e) => updateColumn(index, e.target.value)}
                className={cn(
                  inputCls,
                  "w-[160px] min-w-[160px] cursor-pointer",
                  !draft.column && "text-[var(--text-muted)]",
                )}
              >
                <option value="" disabled>
                  Column...
                </option>
                {columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Operator select */}
              <select
                value={draft.operator}
                onChange={(e) => updateOperator(index, e.target.value as FilterOperator)}
                disabled={!draft.column}
                className={cn(inputCls, "w-[130px] min-w-[130px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed")}
              >
                {operators.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>

              {/* Value input */}
              {needsValue && draft.column && (
                isEnum ? (
                  <select
                    value={draft.value}
                    onChange={(e) => {
                      const next = drafts.map((d, i) =>
                        i === index ? { ...d, value: e.target.value } : d,
                      );
                      commitDrafts(next);
                    }}
                    className={cn(inputCls, "flex-1 min-w-0 cursor-pointer")}
                  >
                    <option value="" disabled>
                      Value...
                    </option>
                    {col!.enumValues!.map((ev) => (
                      <option key={ev} value={ev}>
                        {ev}
                      </option>
                    ))}
                  </select>
                ) : isBetween ? (
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <DebouncedInput
                      value={draft.value}
                      onChange={(v) => updateValue(index, v)}
                      type={cat === "number" ? "number" : cat === "date" ? "date" : "text"}
                      placeholder="From"
                      className={cn(inputCls, "flex-1 min-w-0")}
                      invalid={isValueInvalid(draft, draft.value)}
                    />
                    <DebouncedInput
                      value={draft.value2}
                      onChange={(v) => updateValue2(index, v)}
                      type={cat === "number" ? "number" : cat === "date" ? "date" : "text"}
                      placeholder="To"
                      className={cn(inputCls, "flex-1 min-w-0")}
                      invalid={isValueInvalid(draft, draft.value2)}
                    />
                  </div>
                ) : (
                  <DebouncedInput
                    value={draft.value}
                    onChange={(v) => updateValue(index, v)}
                    type={cat === "number" ? "number" : cat === "date" ? "date" : "text"}
                    placeholder="Value..."
                    className={cn(inputCls, "flex-1 min-w-0")}
                    invalid={isValueInvalid(draft, draft.value)}
                  />
                )
              )}

              {/* Spacer when no value input needed */}
              {(!needsValue || !draft.column) && <div className="flex-1" />}

              {/* Remove */}
              <button
                onClick={() => removeFilterRule(index)}
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded shrink-0",
                  "text-[var(--text-muted)] hover:text-red-400",
                  "hover:bg-red-500/10 transition-colors",
                )}
                title="Remove filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add button */}
      {canAddMore && (
        <div className="px-4 pb-2">
          <button
            onClick={addFilterRule}
            className={cn(
              "flex items-center gap-1.5 px-3 h-8 rounded text-xs",
              "border border-dashed border-[var(--border-color)]",
              "text-[var(--text-muted)] hover:text-[var(--accent)]",
              "hover:border-[var(--accent)]/50 transition-colors",
            )}
          >
            <Plus className="w-3 h-3" />
            Add filter
          </button>
        </div>
      )}
    </div>
  );
}
