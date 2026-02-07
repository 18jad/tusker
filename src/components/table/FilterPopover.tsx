import { useState, useRef, useEffect, useCallback } from "react";
import { Filter, Plus, X } from "lucide-react";
import { cn } from "../../lib/utils";
import type { Column, FilterCondition, FilterOperator } from "../../types";

// ---------------------------------------------------------------------------
// Type-category mapping
// ---------------------------------------------------------------------------

type ColumnCategory = "text" | "number" | "boolean" | "date" | "enum" | "uuid" | "json" | "array";

function getColumnCategory(col: Column): ColumnCategory {
  const t = col.dataType.toUpperCase();

  // Boolean — information_schema: "boolean", SQLx OID: "BOOL"
  if (t === "BOOLEAN" || t === "BOOL") return "boolean";

  // Numeric — information_schema: "integer","smallint","bigint","numeric","decimal",
  //   "real","double precision"  /  SQLx OID: "INT2","INT4","INT8","FLOAT4","FLOAT8", etc.
  if (
    [
      "INTEGER", "SMALLINT", "BIGINT", "NUMERIC", "DECIMAL",
      "REAL", "DOUBLE PRECISION", "SERIAL", "BIGSERIAL", "SMALLSERIAL",
      "INT2", "INT4", "INT8", "FLOAT4", "FLOAT8",
    ].includes(t)
  )
    return "number";

  // Date / time — information_schema: "date","time without time zone",
  //   "time with time zone","timestamp without time zone","timestamp with time zone"
  //   SQLx OID: "DATE","TIME","TIMETZ","TIMESTAMP","TIMESTAMPTZ"
  if (t.startsWith("TIMESTAMP") || t.startsWith("DATE") || t.startsWith("TIME")) return "date";

  // UUID
  if (t === "UUID") return "uuid";

  // JSON
  if (t === "JSON" || t === "JSONB") return "json";

  // Array — information_schema: "ARRAY", SQLx OID: ends with "[]"
  if (t === "ARRAY" || t.endsWith("[]")) return "array";

  // Enum — USER-DEFINED with known enum values
  if (col.enumValues && col.enumValues.length > 0) return "enum";

  return "text";
}

// ---------------------------------------------------------------------------
// Operator definitions per category
// ---------------------------------------------------------------------------

interface OperatorDef {
  value: FilterOperator;
  label: string;
}

const TEXT_OPERATORS: OperatorDef[] = [
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "not contains" },
  { value: "equals", label: "=" },
  { value: "not_equals", label: "!=" },
  { value: "starts_with", label: "starts with" },
  { value: "ends_with", label: "ends with" },
  { value: "is_null", label: "is null" },
  { value: "is_not_null", label: "is not null" },
];

const NUMBER_OPERATORS: OperatorDef[] = [
  { value: "equals", label: "=" },
  { value: "not_equals", label: "!=" },
  { value: "greater_than", label: ">" },
  { value: "less_than", label: "<" },
  { value: "greater_than_or_equal", label: ">=" },
  { value: "less_than_or_equal", label: "<=" },
  { value: "between", label: "between" },
  { value: "is_null", label: "is null" },
  { value: "is_not_null", label: "is not null" },
];

const BOOLEAN_OPERATORS: OperatorDef[] = [
  { value: "is_true", label: "is true" },
  { value: "is_false", label: "is false" },
  { value: "is_null", label: "is null" },
  { value: "is_not_null", label: "is not null" },
];

const DATE_OPERATORS: OperatorDef[] = [
  { value: "equals", label: "=" },
  { value: "not_equals", label: "!=" },
  { value: "greater_than", label: "after" },
  { value: "less_than", label: "before" },
  { value: "between", label: "between" },
  { value: "is_null", label: "is null" },
  { value: "is_not_null", label: "is not null" },
];

const ENUM_OPERATORS: OperatorDef[] = [
  { value: "equals", label: "=" },
  { value: "not_equals", label: "!=" },
  { value: "is_null", label: "is null" },
  { value: "is_not_null", label: "is not null" },
];

const UUID_OPERATORS: OperatorDef[] = [
  { value: "equals", label: "=" },
  { value: "not_equals", label: "!=" },
  { value: "is_null", label: "is null" },
  { value: "is_not_null", label: "is not null" },
];

const JSON_OPERATORS: OperatorDef[] = [
  { value: "is_null", label: "is null" },
  { value: "is_not_null", label: "is not null" },
  { value: "contains", label: "contains" },
];

const ARRAY_OPERATORS: OperatorDef[] = [
  { value: "is_null", label: "is null" },
  { value: "is_not_null", label: "is not null" },
  { value: "contains", label: "contains" },
];

const OPERATORS_BY_CATEGORY: Record<ColumnCategory, OperatorDef[]> = {
  text: TEXT_OPERATORS,
  number: NUMBER_OPERATORS,
  boolean: BOOLEAN_OPERATORS,
  date: DATE_OPERATORS,
  enum: ENUM_OPERATORS,
  uuid: UUID_OPERATORS,
  json: JSON_OPERATORS,
  array: ARRAY_OPERATORS,
};

const DEFAULT_OPERATOR: Record<ColumnCategory, FilterOperator> = {
  text: "contains",
  number: "equals",
  boolean: "is_true",
  date: "equals",
  enum: "equals",
  uuid: "equals",
  json: "is_not_null",
  array: "is_not_null",
};

const NO_VALUE_OPERATORS: FilterOperator[] = ["is_null", "is_not_null", "is_true", "is_false"];

// ---------------------------------------------------------------------------
// Value validation per column category
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns true when the value is acceptable for the given category + operator. */
function isValueValid(category: ColumnCategory, _operator: FilterOperator, value: string): boolean {
  if (value === "") return false; // empty is "incomplete", not invalid

  switch (category) {
    case "number":
      return value.trim() !== "" && !isNaN(Number(value));
    case "date":
      // Accept anything Date.parse understands (ISO dates, timestamps, etc.)
      return !isNaN(Date.parse(value));
    case "uuid":
      return UUID_RE.test(value.trim());
    // text, enum, json, array, boolean — always valid (boolean uses no-value ops)
    default:
      return true;
  }
}

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
// Draft filter type
// ---------------------------------------------------------------------------

interface DraftFilter {
  column: string;
  operator: FilterOperator;
  value: string;
  value2: string;
}

// ---------------------------------------------------------------------------
// FilterPopover
// ---------------------------------------------------------------------------

interface FilterPopoverProps {
  columns: Column[];
  filters: FilterCondition[];
  onFiltersChange: (filters: FilterCondition[]) => void;
}

export function FilterPopover({ columns, filters, onFiltersChange }: FilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const toDrafts = (f: FilterCondition[]): DraftFilter[] =>
    f.map((fc) => ({
      column: fc.column,
      operator: fc.operator,
      value: fc.value ?? "",
      value2: fc.value2 ?? "",
    }));

  const [drafts, setDrafts] = useState<DraftFilter[]>(toDrafts(filters));

  // Track whether the last filters change came from us so we can skip
  // the sync effect and avoid overwriting in-progress drafts.
  const selfCommitRef = useRef(false);

  // Sync drafts when filters change *externally* (e.g. reset button)
  useEffect(() => {
    if (selfCommitRef.current) {
      selfCommitRef.current = false;
      return;
    }
    setDrafts(toDrafts(filters));
  }, [filters]);

  /** Get the category for a draft's column */
  const getCategoryForDraft = useCallback(
    (d: DraftFilter): ColumnCategory => {
      const col = columns.find((c) => c.name === d.column);
      return col ? getColumnCategory(col) : "text";
    },
    [columns],
  );

  /** Validate & propagate only complete + valid rules */
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

  // Close on click outside / Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        // Drop incomplete drafts on close
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
      // Clear value2 if switching away from between
      if (op !== "between") updated.value2 = "";
      return updated;
    });
    // Commit immediately for no-value operators (value is irrelevant)
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

  const getOperatorsForDraft = (d: DraftFilter): OperatorDef[] => {
    if (!d.column) return TEXT_OPERATORS;
    const col = columns.find((c) => c.name === d.column);
    const cat = col ? getColumnCategory(col) : "text";
    return OPERATORS_BY_CATEGORY[cat];
  };

  const getColumnForDraft = (d: DraftFilter): Column | undefined =>
    columns.find((c) => c.name === d.column);

  /** True when the user has typed something but it's not valid for the type */
  const isValueInvalid = (d: DraftFilter, val: string): boolean => {
    if (!d.column || val === "") return false;
    if (NO_VALUE_OPERATORS.includes(d.operator)) return false;
    return !isValueValid(getCategoryForDraft(d), d.operator, val);
  };

  const inputCls = cn(
    "h-7 px-2 text-xs rounded",
    "bg-[var(--bg-primary)] text-[var(--text-primary)]",
    "border border-[var(--border-color)]",
    "focus:border-[var(--accent)] focus:outline-none",
  );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs",
          "transition-colors",
          hasFilters
            ? "text-[var(--accent)] hover:bg-[var(--accent)]/10"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]",
        )}
        title="Filter rules"
      >
        <Filter className="w-3.5 h-3.5" />
        <span>Filter</span>
        {hasFilters && (
          <span className="min-w-[16px] h-4 flex items-center justify-center rounded-full bg-[var(--accent)] text-white text-[10px] font-semibold px-1">
            {filters.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className={cn(
            "absolute z-[100] right-0 mt-1 w-[420px]",
            "bg-[var(--bg-secondary)] border border-[var(--border-color)]",
            "rounded-lg shadow-xl shadow-black/30",
            "animate-in fade-in zoom-in-95 duration-100",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)]">
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
          <div className="p-2 space-y-1.5 max-h-[280px] overflow-y-auto">
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
                <div key={index} className="flex items-center gap-1.5">
                  {/* Column select */}
                  <select
                    value={draft.column}
                    onChange={(e) => updateColumn(index, e.target.value)}
                    className={cn(
                      inputCls,
                      "w-[120px] min-w-[120px] cursor-pointer",
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
                    className={cn(inputCls, "w-[110px] min-w-[110px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed")}
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
                      <div className="flex-1 min-w-0 flex items-center gap-1">
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
                      "flex items-center justify-center w-7 h-7 rounded shrink-0",
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
            <div className="px-2 pb-2">
              <button
                onClick={addFilterRule}
                className={cn(
                  "w-full flex items-center justify-center gap-1.5 h-7 rounded text-xs",
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
      )}
    </div>
  );
}
