// Project/Connection types
export interface Project {
  id: string;
  name: string;
  color: ProjectColor;
  connection: ConnectionConfig;
  settings: ProjectSettings;
  lastConnected?: string;
  createdAt: string;
}

export type ProjectColor = "blue" | "green" | "yellow" | "orange" | "red" | "purple";

export interface ConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

export interface ProjectSettings {
  instantCommit: boolean;
  readOnly: boolean;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

// Database schema types
export interface Schema {
  name: string;
  tables: Table[];
}

export interface Table {
  name: string;
  schema: string;
  columns?: Column[];
  rowCount?: number;
}

export interface ForeignKeyInfo {
  constraintName: string;
  referencedSchema: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface Column {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignKeyInfo?: ForeignKeyInfo;
  defaultValue?: string;
  enumValues?: string[];
}

// Data types
export interface TableData {
  columns: Column[];
  rows: Row[];
  totalRows: number;
  page: number;
  pageSize: number;
}

export type Row = Record<string, CellValue>;
export type CellValue = string | number | boolean | null | object;

// Staged changes
export interface StagedChange {
  id: string;
  type: "insert" | "update" | "delete";
  table: string;
  schema: string;
  data: Row;
  originalData?: Row;
  sql: string;
}

// Sort
export interface SortColumn {
  column: string;
  direction: "ASC" | "DESC";
}

// Filter
export type FilterOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "less_than"
  | "greater_than_or_equal"
  | "less_than_or_equal"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "is_null"
  | "is_not_null"
  | "is_true"
  | "is_false"
  | "between"
  | "in";

export interface FilterCondition {
  column: string;
  operator: FilterOperator;
  value?: string;
  value2?: string;
  values?: string[];
}

// Tab types
export interface Tab {
  id: string;
  type: "table" | "query" | "create-table" | "edit-table" | "import-data" | "history" | "staged-changes";
  title: string;
  schema?: string;
  table?: string;
  queryContent?: string;
  createTableSchema?: string; // Pre-selected schema for create-table tabs
  importFormat?: "csv" | "json"; // Format for import-data tabs
  pinned?: boolean;
}

// Command palette
export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
  category: "navigation" | "project" | "table" | "query";
}

// Commit history
export interface CommitRecord {
  id: string;
  parent_id: string | null;
  message: string;
  summary: string;
  created_at: string;
  change_count: number;
}

export interface CommitChangeRecord {
  id: number;
  commit_id: string;
  type: "insert" | "update" | "delete";
  schema_name: string;
  table_name: string;
  data: string;
  original_data: string | null;
  sql: string;
  sort_order: number;
}

export interface CommitDetail {
  commit: CommitRecord;
  changes: CommitChangeRecord[];
}
