import type { Column, FilterCondition, FilterOperator } from "../../types";

// ---------------------------------------------------------------------------
// Type-category mapping
// ---------------------------------------------------------------------------

export type ColumnCategory = "text" | "number" | "boolean" | "date" | "enum" | "uuid" | "json" | "array";

export function getColumnCategory(col: Column): ColumnCategory {
  const t = col.dataType.toUpperCase();

  if (t === "BOOLEAN" || t === "BOOL") return "boolean";

  if (
    [
      "INTEGER", "SMALLINT", "BIGINT", "NUMERIC", "DECIMAL",
      "REAL", "DOUBLE PRECISION", "SERIAL", "BIGSERIAL", "SMALLSERIAL",
      "INT2", "INT4", "INT8", "FLOAT4", "FLOAT8",
    ].includes(t)
  )
    return "number";

  if (t.startsWith("TIMESTAMP") || t.startsWith("DATE") || t.startsWith("TIME")) return "date";

  if (t === "UUID") return "uuid";

  if (t === "JSON" || t === "JSONB") return "json";

  if (t === "ARRAY" || t.endsWith("[]")) return "array";

  if (col.enumValues && col.enumValues.length > 0) return "enum";

  return "text";
}

// ---------------------------------------------------------------------------
// Operator definitions per category
// ---------------------------------------------------------------------------

export interface OperatorDef {
  value: FilterOperator;
  label: string;
}

export const TEXT_OPERATORS: OperatorDef[] = [
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "not contains" },
  { value: "equals", label: "=" },
  { value: "not_equals", label: "!=" },
  { value: "starts_with", label: "starts with" },
  { value: "ends_with", label: "ends with" },
  { value: "is_null", label: "is null" },
  { value: "is_not_null", label: "is not null" },
];

export const NUMBER_OPERATORS: OperatorDef[] = [
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

export const BOOLEAN_OPERATORS: OperatorDef[] = [
  { value: "is_true", label: "is true" },
  { value: "is_false", label: "is false" },
  { value: "is_null", label: "is null" },
  { value: "is_not_null", label: "is not null" },
];

export const DATE_OPERATORS: OperatorDef[] = [
  { value: "equals", label: "=" },
  { value: "not_equals", label: "!=" },
  { value: "greater_than", label: "after" },
  { value: "less_than", label: "before" },
  { value: "between", label: "between" },
  { value: "is_null", label: "is null" },
  { value: "is_not_null", label: "is not null" },
];

export const ENUM_OPERATORS: OperatorDef[] = [
  { value: "equals", label: "=" },
  { value: "not_equals", label: "!=" },
  { value: "is_null", label: "is null" },
  { value: "is_not_null", label: "is not null" },
];

export const UUID_OPERATORS: OperatorDef[] = [
  { value: "equals", label: "=" },
  { value: "not_equals", label: "!=" },
  { value: "is_null", label: "is null" },
  { value: "is_not_null", label: "is not null" },
];

export const JSON_OPERATORS: OperatorDef[] = [
  { value: "is_null", label: "is null" },
  { value: "is_not_null", label: "is not null" },
  { value: "contains", label: "contains" },
];

export const ARRAY_OPERATORS: OperatorDef[] = [
  { value: "is_null", label: "is null" },
  { value: "is_not_null", label: "is not null" },
  { value: "contains", label: "contains" },
];

export const OPERATORS_BY_CATEGORY: Record<ColumnCategory, OperatorDef[]> = {
  text: TEXT_OPERATORS,
  number: NUMBER_OPERATORS,
  boolean: BOOLEAN_OPERATORS,
  date: DATE_OPERATORS,
  enum: ENUM_OPERATORS,
  uuid: UUID_OPERATORS,
  json: JSON_OPERATORS,
  array: ARRAY_OPERATORS,
};

export const DEFAULT_OPERATOR: Record<ColumnCategory, FilterOperator> = {
  text: "contains",
  number: "equals",
  boolean: "is_true",
  date: "equals",
  enum: "equals",
  uuid: "equals",
  json: "is_not_null",
  array: "is_not_null",
};

export const NO_VALUE_OPERATORS: FilterOperator[] = ["is_null", "is_not_null", "is_true", "is_false"];

// ---------------------------------------------------------------------------
// Value validation per column category
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValueValid(category: ColumnCategory, _operator: FilterOperator, value: string): boolean {
  if (value === "") return false;

  switch (category) {
    case "number":
      return value.trim() !== "" && !isNaN(Number(value));
    case "date":
      return !isNaN(Date.parse(value));
    case "uuid":
      return UUID_RE.test(value.trim());
    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// Draft filter type & helpers
// ---------------------------------------------------------------------------

export interface DraftFilter {
  column: string;
  operator: FilterOperator;
  value: string;
  value2: string;
}

export function toDrafts(f: FilterCondition[]): DraftFilter[] {
  return f.map((fc) => ({
    column: fc.column,
    operator: fc.operator,
    value: fc.value ?? "",
    value2: fc.value2 ?? "",
  }));
}

// ---------------------------------------------------------------------------
// Chip label helper
// ---------------------------------------------------------------------------

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: "=",
  not_equals: "!=",
  greater_than: ">",
  less_than: "<",
  greater_than_or_equal: ">=",
  less_than_or_equal: "<=",
  contains: "contains",
  not_contains: "not contains",
  starts_with: "starts with",
  ends_with: "ends with",
  is_null: "is null",
  is_not_null: "is not null",
  is_true: "is true",
  is_false: "is false",
  between: "between",
  in: "in",
};

export function getFilterChipLabel(filter: FilterCondition, columns: Column[]): string {
  const col = columns.find((c) => c.name === filter.column);
  const colName = col?.name ?? filter.column;

  const opLabel = OPERATOR_LABELS[filter.operator] ?? filter.operator;

  if (NO_VALUE_OPERATORS.includes(filter.operator)) {
    return `${colName} ${opLabel}`;
  }

  if (filter.operator === "between" && filter.value && filter.value2) {
    return `${colName} ${filter.value}..${filter.value2}`;
  }

  if (filter.value) {
    return `${colName} ${opLabel} ${filter.value}`;
  }

  return `${colName} ${opLabel}`;
}
