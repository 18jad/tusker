import type { Row, Column } from "../types";

/**
 * Generate INSERT SQL statement
 */
export function generateInsertSQL(
  schema: string,
  table: string,
  data: Row,
  columns: Column[]
): string {
  const columnNames = Object.keys(data)
    .filter((key) => data[key] !== undefined)
    .map((key) => `"${key}"`)
    .join(", ");

  const values = Object.keys(data)
    .filter((key) => data[key] !== undefined)
    .map((key) => formatValue(data[key], columns.find((c) => c.name === key)))
    .join(", ");

  return `INSERT INTO "${schema}"."${table}" (${columnNames}) VALUES (${values})`;
}

/**
 * Generate UPDATE SQL statement
 */
export function generateUpdateSQL(
  schema: string,
  table: string,
  data: Row,
  originalData: Row,
  columns: Column[]
): string {
  const setParts = Object.keys(data)
    .filter((key) => data[key] !== originalData[key])
    .map((key) => {
      const col = columns.find((c) => c.name === key);
      return `"${key}" = ${formatValue(data[key], col)}`;
    })
    .join(", ");

  const whereParts = buildWhereClause(originalData, columns);

  return `UPDATE "${schema}"."${table}" SET ${setParts} WHERE ${whereParts}`;
}

/**
 * Generate DELETE SQL statement
 */
export function generateDeleteSQL(
  schema: string,
  table: string,
  data: Row,
  columns: Column[]
): string {
  const whereParts = buildWhereClause(data, columns);
  return `DELETE FROM "${schema}"."${table}" WHERE ${whereParts}`;
}

/**
 * Build WHERE clause from row data (prefer primary keys)
 */
function buildWhereClause(data: Row, columns: Column[]): string {
  // First try to use primary key columns
  const pkColumns = columns.filter((c) => c.isPrimaryKey);

  if (pkColumns.length > 0) {
    return pkColumns
      .map((col) => `"${col.name}" = ${formatValue(data[col.name], col)}`)
      .join(" AND ");
  }

  // Fall back to all columns
  return Object.keys(data)
    .map((key) => {
      const col = columns.find((c) => c.name === key);
      const value = data[key];
      if (value === null) {
        return `"${key}" IS NULL`;
      }
      return `"${key}" = ${formatValue(value, col)}`;
    })
    .join(" AND ");
}

/**
 * Format a value for SQL based on its type
 */
function formatValue(value: unknown, _column?: Column): string {
  if (value === null || value === undefined) {
    return "NULL";
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "object") {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }

  // String - escape single quotes
  const escaped = String(value).replace(/'/g, "''");
  return `'${escaped}'`;
}

/**
 * Validate SQL to prevent obvious injection (basic check)
 */
export function validateSQL(sql: string): { valid: boolean; error?: string } {
  // Check for common dangerous patterns
  const dangerous = [
    /;\s*drop\s+/i,
    /;\s*delete\s+from\s+(?!.*where)/i,
    /;\s*truncate\s+/i,
    /;\s*alter\s+/i,
    /--/,
    /\/\*/,
  ];

  for (const pattern of dangerous) {
    if (pattern.test(sql)) {
      return { valid: false, error: "Query contains potentially dangerous patterns" };
    }
  }

  return { valid: true };
}
