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

// Tab types
export interface Tab {
  id: string;
  type: "table" | "query" | "create-table" | "import-data";
  title: string;
  schema?: string;
  table?: string;
  queryContent?: string;
  createTableSchema?: string; // Pre-selected schema for create-table tabs
  importFormat?: "csv" | "json"; // Format for import-data tabs
}

// Command palette
export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
  category: "navigation" | "project" | "table" | "query";
}
