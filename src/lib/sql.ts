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
 * Column with a stable id for diffing in ALTER TABLE generation
 */
export interface AlterColumnDef {
  id: string;
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isUnique: boolean;
  defaultValue: string;
  isForeignKey: boolean;
  foreignKeySchema: string;
  foreignKeyTable: string;
  foreignKeyColumn: string;
  foreignKeyOnDelete: ForeignKeyAction;
  foreignKeyOnUpdate: ForeignKeyAction;
  foreignKeyConstraintName: string; // original constraint name for dropping
}

function buildReferencesClause(col: AlterColumnDef): string {
  let ref = `REFERENCES "${col.foreignKeySchema}"."${col.foreignKeyTable}"("${col.foreignKeyColumn}")`;
  if (col.foreignKeyOnDelete && col.foreignKeyOnDelete !== "NO ACTION") {
    ref += ` ON DELETE ${col.foreignKeyOnDelete}`;
  }
  if (col.foreignKeyOnUpdate && col.foreignKeyOnUpdate !== "NO ACTION") {
    ref += ` ON UPDATE ${col.foreignKeyOnUpdate}`;
  }
  return ref;
}

/**
 * Generate ALTER TABLE SQL statements by diffing original vs edited columns
 */
export function generateAlterTableSQL(
  schema: string,
  tableName: string,
  originalColumns: AlterColumnDef[],
  editedColumns: AlterColumnDef[],
  newTableName?: string
): string[] {
  const stmts: string[] = [];
  const effTableName = newTableName || tableName;
  const tbl = `"${schema}"."${effTableName}"`;

  // Table rename (must come first — subsequent statements use the new name)
  if (newTableName && newTableName !== tableName) {
    stmts.push(`ALTER TABLE "${schema}"."${tableName}" RENAME TO "${newTableName}"`);
  }

  const originalById = new Map(originalColumns.map((c) => [c.id, c]));
  const editedById = new Map(editedColumns.map((c) => [c.id, c]));

  // Dropped columns: in original but not in edited
  for (const orig of originalColumns) {
    if (!editedById.has(orig.id)) {
      stmts.push(`ALTER TABLE ${tbl} DROP COLUMN "${orig.name}"`);
    }
  }

  // Modified columns: in both original and edited
  for (const edited of editedColumns) {
    const orig = originalById.get(edited.id);
    if (!orig) continue; // new column, handled below

    // Rename
    if (edited.name !== orig.name) {
      stmts.push(`ALTER TABLE ${tbl} RENAME COLUMN "${orig.name}" TO "${edited.name}"`);
    }

    // Use the current column name (after potential rename) for subsequent ALTER COLUMN
    const colName = edited.name;

    // Type change
    if (edited.dataType !== orig.dataType) {
      stmts.push(
        `ALTER TABLE ${tbl} ALTER COLUMN "${colName}" TYPE ${edited.dataType} USING "${colName}"::${edited.dataType}`
      );
    }

    // Nullable change
    if (edited.isNullable !== orig.isNullable) {
      stmts.push(
        edited.isNullable
          ? `ALTER TABLE ${tbl} ALTER COLUMN "${colName}" DROP NOT NULL`
          : `ALTER TABLE ${tbl} ALTER COLUMN "${colName}" SET NOT NULL`
      );
    }

    // Default change
    if (edited.defaultValue !== orig.defaultValue) {
      if (edited.defaultValue.trim()) {
        stmts.push(
          `ALTER TABLE ${tbl} ALTER COLUMN "${colName}" SET DEFAULT ${edited.defaultValue}`
        );
      } else {
        stmts.push(`ALTER TABLE ${tbl} ALTER COLUMN "${colName}" DROP DEFAULT`);
      }
    }

    // Primary key change
    if (edited.isPrimaryKey !== orig.isPrimaryKey) {
      if (edited.isPrimaryKey) {
        stmts.push(`ALTER TABLE ${tbl} ADD PRIMARY KEY ("${colName}")`);
      } else {
        stmts.push(`ALTER TABLE ${tbl} DROP CONSTRAINT "${effTableName}_pkey"`);
      }
    }

    // Unique change
    if (edited.isUnique !== orig.isUnique) {
      if (edited.isUnique) {
        stmts.push(`ALTER TABLE ${tbl} ADD UNIQUE ("${colName}")`);
      } else {
        stmts.push(`ALTER TABLE ${tbl} DROP CONSTRAINT "${effTableName}_${colName}_key"`);
      }
    }

    // Foreign key change
    const origHasFK = orig.isForeignKey && orig.foreignKeySchema && orig.foreignKeyTable && orig.foreignKeyColumn;
    const editedHasFK = edited.isForeignKey && edited.foreignKeySchema && edited.foreignKeyTable && edited.foreignKeyColumn;

    if (origHasFK && !editedHasFK) {
      // FK removed
      const constraintName = orig.foreignKeyConstraintName || `${effTableName}_${orig.name}_fkey`;
      stmts.push(`ALTER TABLE ${tbl} DROP CONSTRAINT "${constraintName}"`);
    } else if (!origHasFK && editedHasFK) {
      // FK added
      stmts.push(`ALTER TABLE ${tbl} ADD FOREIGN KEY ("${colName}") ${buildReferencesClause(edited)}`);
    } else if (origHasFK && editedHasFK) {
      // FK changed (different target or different actions)
      const changed =
        orig.foreignKeySchema !== edited.foreignKeySchema ||
        orig.foreignKeyTable !== edited.foreignKeyTable ||
        orig.foreignKeyColumn !== edited.foreignKeyColumn ||
        orig.foreignKeyOnDelete !== edited.foreignKeyOnDelete ||
        orig.foreignKeyOnUpdate !== edited.foreignKeyOnUpdate;
      if (changed) {
        const constraintName = orig.foreignKeyConstraintName || `${effTableName}_${orig.name}_fkey`;
        stmts.push(`ALTER TABLE ${tbl} DROP CONSTRAINT "${constraintName}"`);
        stmts.push(`ALTER TABLE ${tbl} ADD FOREIGN KEY ("${colName}") ${buildReferencesClause(edited)}`);
      }
    }
  }

  // Added columns: in edited but not in original
  for (const edited of editedColumns) {
    if (originalById.has(edited.id)) continue;
    if (!edited.name.trim()) continue;

    const parts = [`ADD COLUMN "${edited.name}" ${edited.dataType}`];
    if (edited.isPrimaryKey) {
      parts.push("PRIMARY KEY");
    } else {
      if (!edited.isNullable) {
        parts.push("NOT NULL");
      }
      if (edited.isUnique) {
        parts.push("UNIQUE");
      }
    }
    if (edited.defaultValue.trim()) {
      parts.push(`DEFAULT ${edited.defaultValue}`);
    }
    if (edited.isForeignKey && edited.foreignKeySchema && edited.foreignKeyTable && edited.foreignKeyColumn) {
      parts.push(buildReferencesClause(edited));
    }
    stmts.push(`ALTER TABLE ${tbl} ${parts.join(" ")}`);
  }

  return stmts;
}

// ============================================================================
// Index types and SQL generation
// ============================================================================

export type IndexMethod = "btree" | "hash" | "gin" | "gist" | "spgist" | "brin";

export interface IndexColumnDef {
  id: string;
  mode: "column" | "expression";
  column: string;
  expression: string;
  sortDirection: "ASC" | "DESC";
  nullsOrder: "DEFAULT" | "NULLS FIRST" | "NULLS LAST";
}

export interface IndexDef {
  id: string;
  name: string;
  indexType: IndexMethod;
  isUnique: boolean;
  isConcurrently: boolean;
  columns: IndexColumnDef[];
  whereClause: string;
}

/**
 * Generate a CREATE INDEX SQL statement from an IndexDef
 */
export function generateCreateIndexSQL(
  schema: string,
  tableName: string,
  index: IndexDef
): string {
  const parts: string[] = ["CREATE"];

  if (index.isUnique) {
    parts.push("UNIQUE");
  }

  parts.push("INDEX");

  if (index.isConcurrently) {
    parts.push("CONCURRENTLY");
  }

  parts.push(`"${index.name}"`);
  parts.push("ON");
  parts.push(`"${schema}"."${tableName}"`);

  if (index.indexType !== "btree") {
    parts.push(`USING ${index.indexType}`);
  }

  // Build column list
  const colDefs = index.columns.map((col) => {
    const colParts: string[] = [];

    if (col.mode === "expression" && col.expression.trim()) {
      // Wrap expression in parens if it doesn't already have them
      const expr = col.expression.trim();
      if (expr.startsWith("(") && expr.endsWith(")")) {
        colParts.push(expr);
      } else {
        colParts.push(`(${expr})`);
      }
    } else if (col.column) {
      colParts.push(`"${col.column}"`);
    }

    // Sort direction and nulls order only apply to btree indexes
    if (index.indexType === "btree") {
      if (col.sortDirection === "DESC") {
        colParts.push("DESC");
      }
      if (col.nullsOrder !== "DEFAULT") {
        colParts.push(col.nullsOrder);
      }
    }

    return colParts.join(" ");
  }).filter(Boolean);

  parts.push(`(${colDefs.join(", ")})`);

  // WHERE clause for partial indexes
  if (index.whereClause.trim()) {
    parts.push(`WHERE ${index.whereClause.trim()}`);
  }

  return parts.join(" ");
}

/**
 * Generate DROP INDEX SQL statement
 */
export function generateDropIndexSQL(
  schema: string,
  indexName: string,
  concurrently?: boolean
): string {
  const parts = ["DROP INDEX"];
  if (concurrently) {
    parts.push("CONCURRENTLY");
  }
  parts.push(`"${schema}"."${indexName}"`);
  return parts.join(" ");
}

/**
 * Auto-generate an index name following PostgreSQL convention
 */
export function generateIndexName(tableName: string, columns: IndexColumnDef[]): string {
  const tbl = tableName.trim() || "table";
  const colNames = columns
    .map((c) => {
      if (c.mode === "expression" && c.expression.trim()) {
        // Extract a short name from the expression
        return c.expression.trim()
          .replace(/[^a-zA-Z0-9_]/g, "")
          .substring(0, 20)
          .toLowerCase();
      }
      return c.column.toLowerCase();
    })
    .filter(Boolean);

  if (colNames.length === 0) return `idx_${tbl}`;
  return `idx_${tbl}_${colNames.join("_")}`;
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
