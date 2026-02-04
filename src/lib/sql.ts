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
 * Column definition for CREATE TABLE
 */
export type ForeignKeyAction = "NO ACTION" | "RESTRICT" | "CASCADE" | "SET NULL" | "SET DEFAULT";

export interface ColumnDefinition {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isUnique: boolean;
  defaultValue: string;
  references?: {
    schema: string;
    table: string;
    column: string;
    onDelete?: ForeignKeyAction;
    onUpdate?: ForeignKeyAction;
  };
}

/**
 * Generate CREATE TABLE SQL statement
 */
export function generateCreateTableSQL(
  schema: string,
  tableName: string,
  columns: ColumnDefinition[]
): string {
  if (!tableName.trim()) {
    throw new Error("Table name is required");
  }

  if (columns.length === 0) {
    throw new Error("At least one column is required");
  }

  const primaryKeyColumns = columns.filter((c) => c.isPrimaryKey);
  const hasCompositePK = primaryKeyColumns.length > 1;

  const columnDefs = columns.map((col) => {
    if (!col.name.trim()) {
      throw new Error("Column name is required");
    }
    if (!col.dataType.trim()) {
      throw new Error(`Data type is required for column "${col.name}"`);
    }

    const parts: string[] = [`"${col.name}"`, col.dataType];

    // Add PRIMARY KEY inline only if single PK
    if (col.isPrimaryKey && !hasCompositePK) {
      parts.push("PRIMARY KEY");
    }

    // Add NOT NULL (skip for PKs as they're implicitly NOT NULL)
    if (!col.isNullable && !col.isPrimaryKey) {
      parts.push("NOT NULL");
    }

    // Add UNIQUE
    if (col.isUnique && !col.isPrimaryKey) {
      parts.push("UNIQUE");
    }

    // Add DEFAULT
    if (col.defaultValue.trim()) {
      parts.push(`DEFAULT ${col.defaultValue}`);
    }

    // Add REFERENCES with ON DELETE/UPDATE actions
    if (col.references) {
      let refClause = `REFERENCES "${col.references.schema}"."${col.references.table}"("${col.references.column}")`;
      if (col.references.onDelete && col.references.onDelete !== "NO ACTION") {
        refClause += ` ON DELETE ${col.references.onDelete}`;
      }
      if (col.references.onUpdate && col.references.onUpdate !== "NO ACTION") {
        refClause += ` ON UPDATE ${col.references.onUpdate}`;
      }
      parts.push(refClause);
    }

    return parts.join(" ");
  });

  // Add composite primary key constraint if needed
  if (hasCompositePK) {
    const pkCols = primaryKeyColumns.map((c) => `"${c.name}"`).join(", ");
    columnDefs.push(`PRIMARY KEY (${pkCols})`);
  }

  return `CREATE TABLE "${schema}"."${tableName}" (\n  ${columnDefs.join(",\n  ")}\n)`;
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
