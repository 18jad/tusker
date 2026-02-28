import { invoke } from "@tauri-apps/api/core";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import type { Schema, TableData, Row, SortColumn, FilterCondition, CommitRecord, CommitDetail, Project } from "../types";
import { useProjectStore } from "../stores/projectStore";
import { useUIStore } from "../stores/uiStore";
import { useChangesStore } from "../stores/changesStore";

/**
 * Compatibility shim: derives the active connection ID from the currently active tab.
 * Prefer receiving connectionId as a prop where possible.
 */
export function getCurrentConnectionId(): string | undefined {
  return useUIStore.getState().getActiveConnectionId();
}

interface ConnectRequest {
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl_mode?: "disable" | "prefer" | "require";
  save_connection?: boolean;
}

interface ConnectResponse {
  connection_id: string;
  message: string;
}

interface SchemaWithTables {
  name: string;
  owner: string | null;
  tables: Array<{
    name: string;
    schema: string;
    table_type: string;
    estimated_row_count: number | null;
    description: string | null;
  }>;
}

// Convert backend SchemaWithTables to frontend Schema type
function convertSchemasWithTables(raw: SchemaWithTables[]): Schema[] {
  return raw
    .filter((s) => !s.name.startsWith("pg_") && s.name !== "information_schema")
    .map((s) => ({
      name: s.name,
      tables: s.tables.map((t) => ({
        name: t.name,
        schema: t.schema,
        rowCount: t.estimated_row_count ?? undefined,
      })),
    }));
}

// Connect to database
export function useConnect() {
  const projectStore = useProjectStore;

  return useMutation({
    mutationFn: async (params: { project: Project; password?: string }) => {
      const { project, password: providedPassword } = params;
      const projectId = project.id;

      projectStore.getState().setProjectConnectionStatus(projectId, "connecting");
      projectStore.getState().setProjectError(projectId, null);

      // Fetch password from secure keychain if not provided
      let password = providedPassword || project.connection.password;
      if (!password) {
        try {
          password = await invoke<string>("get_saved_password", { connectionId: projectId });
        } catch {
          // No saved password, will try with empty (may fail auth)
          password = "";
        }
      }

      const request: ConnectRequest = {
        name: project.name,
        host: project.connection.host,
        port: project.connection.port,
        database: project.connection.database,
        username: project.connection.username,
        password,
        ssl_mode: project.connection.ssl ? "require" : "disable",
        save_connection: false,
      };

      const result = await invoke<ConnectResponse>("connect", { request });
      return { result, projectId };
    },
    onSuccess: async ({ result, projectId }) => {
      projectStore.getState().connectProject(projectId, result.connection_id);
      projectStore.getState().setProjectError(projectId, null);

      // Update lastConnected timestamp
      projectStore.getState().updateProject(projectId, {
        lastConnected: new Date().toISOString(),
      });

      projectStore.getState().setProjectSchemasLoading(projectId, true);

      // Fetch all schemas with tables in a single IPC call
      try {
        const raw = await invoke<SchemaWithTables[]>("get_schemas_with_tables", {
          connectionId: result.connection_id,
        });
        projectStore.getState().setProjectSchemas(projectId, convertSchemasWithTables(raw));
      } catch (err) {
        console.error("Failed to fetch schemas:", err);
      } finally {
        projectStore.getState().setProjectSchemasLoading(projectId, false);
      }
    },
    onError: (error: Error, params) => {
      const projectId = params.project.id;
      projectStore.getState().setProjectConnectionStatus(projectId, "error");
      projectStore.getState().setProjectError(projectId, error.message || "Failed to connect to database");
    },
  });
}

// Disconnect from database
export function useDisconnect() {
  const projectStore = useProjectStore;

  return useMutation({
    mutationFn: async (params: { projectId: string; connectionId: string }) => {
      await invoke("disconnect", { connectionId: params.connectionId });
      return params;
    },
    onSuccess: (params) => {
      projectStore.getState().disconnectProject(params.projectId);
      useUIStore.getState().closeTabsForConnection(params.connectionId);
      useChangesStore.getState().clearChangesForConnection(params.connectionId);
    },
    onError: (error: Error, params) => {
      projectStore.getState().setProjectError(params.projectId, error.message);
    },
  });
}

// Test connection
export function useTestConnection() {
  return useMutation({
    mutationFn: async (config: { host: string; port: number; database: string; username: string; password: string; ssl?: boolean }) => {
      const request = {
        host: config.host,
        port: config.port,
        database: config.database,
        username: config.username,
        password: config.password,
        ssl_mode: config.ssl ? "require" : "disable",
      };

      const result = await invoke<string>("test_connection", { request });
      return result;
    },
  });
}

// Fetch schemas
export function useSchemas(connectionId: string) {
  return useQuery({
    queryKey: ["schemas", connectionId],
    queryFn: async () => {
      const raw = await invoke<SchemaWithTables[]>("get_schemas_with_tables", {
        connectionId,
      });
      return convertSchemasWithTables(raw);
    },
    enabled: !!connectionId,
  });
}

interface PaginatedResult {
  rows: Row[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface ForeignKeyInfoRaw {
  constraint_name: string;
  referenced_schema: string;
  referenced_table: string;
  referenced_column: string;
}

interface ColumnInfo {
  name: string;
  data_type: string;
  is_nullable: boolean;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  foreign_key_info: ForeignKeyInfoRaw | null;
  default_value: string | null;
  enum_values: string[] | null;
}

// Full column info from backend (richer than the ColumnInfo used inside useTableData)
export interface FullColumnInfo {
  name: string;
  data_type: string;
  udt_name: string;
  is_nullable: boolean;
  is_primary_key: boolean;
  is_unique: boolean;
  is_foreign_key: boolean;
  foreign_key_info: ForeignKeyInfoRaw | null;
  default_value: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  ordinal_position: number;
  description: string | null;
  enum_values: string[] | null;
}

// Fetch column metadata for a table (for Edit Table)
export function useTableColumns(connectionId: string, schema: string, table: string) {
  return useQuery({
    queryKey: ["tableColumns", connectionId, schema, table],
    queryFn: async () => {
      return invoke<FullColumnInfo[]>("get_columns", {
        connectionId,
        schema,
        table,
      });
    },
    enabled: !!connectionId && !!schema && !!table,
  });
}

// Backend IndexInfo shape
export interface IndexInfoRaw {
  name: string;
  is_unique: boolean;
  is_primary: boolean;
  columns: string[];
  index_type: string;
}

// Fetch indexes for a table (for Edit Table)
export function useTableIndexes(connectionId: string, schema: string, table: string) {
  return useQuery({
    queryKey: ["tableIndexes", connectionId, schema, table],
    queryFn: async () => {
      return invoke<IndexInfoRaw[]>("get_indexes", {
        connectionId,
        schema,
        table,
      });
    },
    enabled: !!connectionId && !!schema && !!table,
  });
}

// Fetch table data with pagination and sorting
export function useTableData(
  connectionId: string,
  schema: string,
  table: string,
  page: number = 1,
  sorts: SortColumn[] = [],
  filters: FilterCondition[] = [],
) {
  const queryClient = useQueryClient();
  const pageSize = 50;
  // Stable keys for React Query cache
  const sortKey = JSON.stringify(sorts);
  const filterKey = JSON.stringify(filters);

  return useQuery({
    queryKey: ["tableData", connectionId, schema, table, page, sortKey, filterKey],
    queryFn: async () => {
      // Build order arrays from explicit sorts (backend auto-detects PK if none provided)
      const orderByColumns = sorts.length > 0 ? sorts.map((s) => s.column) : undefined;
      const orderDirections = sorts.length > 0 ? sorts.map((s) => s.direction) : undefined;

      // Check if columns are already cached (they rarely change)
      const cachedColumns = queryClient.getQueryData<ColumnInfo[]>(["tableColumns", connectionId, schema, table]);

      // Only fetch columns if not cached; always fetch data
      const [columnsResult, dataResult] = await Promise.all([
        cachedColumns
          ? Promise.resolve(cachedColumns)
          : invoke<ColumnInfo[]>("get_columns", {
              connectionId,
              schema,
              table,
            }).then((cols) => {
              // Populate the cache for future calls
              queryClient.setQueryData(["tableColumns", connectionId, schema, table], cols);
              return cols;
            }),
        invoke<PaginatedResult>("fetch_table_data", {
          request: {
            connection_id: connectionId,
            schema,
            table,
            page,
            page_size: pageSize,
            order_by: orderByColumns,
            order_direction: orderDirections,
            filters: filters.length > 0 ? filters : undefined,
          },
        }),
      ]);

      return {
        rows: dataResult.rows,
        columns: columnsResult.map((col: ColumnInfo) => ({
          name: col.name,
          dataType: col.data_type,
          isNullable: col.is_nullable,
          isPrimaryKey: col.is_primary_key,
          isForeignKey: col.is_foreign_key,
          foreignKeyInfo: col.foreign_key_info
            ? {
                constraintName: col.foreign_key_info.constraint_name,
                referencedSchema: col.foreign_key_info.referenced_schema,
                referencedTable: col.foreign_key_info.referenced_table,
                referencedColumn: col.foreign_key_info.referenced_column,
              }
            : undefined,
          defaultValue: col.default_value ?? undefined,
          enumValues: col.enum_values ?? undefined,
        })),
        totalRows: dataResult.total_count,
        page: dataResult.page,
        pageSize: dataResult.page_size,
      } as TableData;
    },
    enabled: !!connectionId && !!schema && !!table,
    staleTime: 30000, // 30 seconds
    placeholderData: keepPreviousData, // Show old data while sort/page change fetches
  });
}

// Insert row
export function useInsertRow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { connectionId: string; schema: string; table: string; data: Row }) => {
      await invoke("insert_row", {
        connectionId: params.connectionId,
        schema: params.schema,
        table: params.table,
        data: params.data,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tableData", variables.connectionId, variables.schema, variables.table],
      });
    },
  });
}

// Update row
export function useUpdateRow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { connectionId: string; schema: string; table: string; data: Row; where: Row }) => {
      await invoke("update_row", {
        connectionId: params.connectionId,
        schema: params.schema,
        table: params.table,
        data: params.data,
        whereClause: params.where,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tableData", variables.connectionId, variables.schema, variables.table],
      });
    },
  });
}

// Delete row
export function useDeleteRow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { connectionId: string; schema: string; table: string; where: Row }) => {
      await invoke("delete_row", {
        connectionId: params.connectionId,
        schema: params.schema,
        table: params.table,
        whereClause: params.where,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tableData", variables.connectionId, variables.schema, variables.table],
      });
    },
  });
}

// Execute raw SQL
export function useExecuteQuery() {
  return useMutation({
    mutationFn: async (params: { connectionId: string; query: string }) => {
      const result = await invoke<TableData>("execute_query", {
        connectionId: params.connectionId,
        sql: params.query,
      });
      return result;
    },
  });
}

// Fetch foreign key reference values for a column
export function useForeignKeyValues(
  connectionId: string,
  schema: string,
  table: string,
  column: string,
  searchQuery: string = "",
  limit: number = 100
) {
  return useQuery({
    queryKey: ["fkValues", connectionId, schema, table, column, searchQuery, limit],
    queryFn: async () => {
      // Build query to fetch distinct values from the referenced column
      const searchCondition = searchQuery
        ? `WHERE "${column}"::text ILIKE '%' || $1 || '%'`
        : "";
      const sql = `
        SELECT DISTINCT "${column}"
        FROM "${schema}"."${table}"
        ${searchCondition}
        ORDER BY "${column}"
        LIMIT ${limit}
      `;

      const result = await invoke<{ rows: Row[] }>("execute_query", {
        connectionId,
        sql: searchQuery ? sql.replace("$1", `'${searchQuery.replace(/'/g, "''")}'`) : sql,
      });

      // Extract the column values
      return result.rows.map((row) => row[column]);
    },
    enabled: !!connectionId && !!schema && !!table && !!column,
    staleTime: 30000, // Cache for 30 seconds
  });
}

// Commit staged changes - execute multiple queries in sequence
export function useCommitChanges() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { connectionId: string; queries: string[] }) => {
      // Execute each query in sequence
      for (const query of params.queries) {
        await invoke("execute_query", {
          connectionId: params.connectionId,
          sql: query,
        });
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tableData", variables.connectionId] });
    },
  });
}

// Migration types
export interface StatementError {
  code?: string;
  message: string;
  detail?: string;
  hint?: string;
}

export interface StatementResult {
  sql: string;
  ok: boolean;
  duration_ms: number;
  rows_affected?: number;
  error?: StatementError;
}

export interface MigrationResult {
  ok: boolean;
  dry_run: boolean;
  committed: boolean;
  duration_ms: number;
  statements: StatementResult[];
  lock_timeout_ms: number;
  statement_timeout_ms: number;
}

// Execute migration (dry-run or apply) with transactional safety
export function useMigration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      connectionId: string;
      projectId: string;
      statements: string[];
      dry_run: boolean;
      lock_timeout_ms?: number;
      statement_timeout_ms?: number;
    }) => {
      const result = await invoke<MigrationResult>("execute_migration", {
        request: {
          connection_id: params.connectionId,
          statements: params.statements,
          dry_run: params.dry_run,
          lock_timeout_ms: params.lock_timeout_ms,
          statement_timeout_ms: params.statement_timeout_ms,
        },
      });
      return { result, connectionId: params.connectionId, projectId: params.projectId };
    },
    onSuccess: async ({ result, connectionId, projectId }) => {
      // Only refresh schemas if we actually committed changes
      if (result.committed) {
        queryClient.invalidateQueries({ queryKey: ["tableData", connectionId] });
        queryClient.invalidateQueries({ queryKey: ["tableColumns", connectionId] });
        queryClient.invalidateQueries({ queryKey: ["tableIndexes", connectionId] });

        const projectStore = useProjectStore.getState();
        projectStore.setProjectSchemasLoading(projectId, true);
        try {
          const raw = await invoke<SchemaWithTables[]>("get_schemas_with_tables", {
            connectionId,
          });
          projectStore.setProjectSchemas(projectId, convertSchemasWithTables(raw));
        } finally {
          projectStore.setProjectSchemasLoading(projectId, false);
        }
      }
    },
  });
}

// Execute a single SQL statement (for DDL like CREATE TABLE)
export function useExecuteSQL() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { connectionId: string; projectId: string; sql: string }) => {
      await invoke("execute_query", {
        connectionId: params.connectionId,
        sql: params.sql,
      });
      return { connectionId: params.connectionId, projectId: params.projectId };
    },
    onSuccess: async ({ connectionId, projectId }) => {
      // Refresh schemas to show new/modified tables
      queryClient.invalidateQueries({ queryKey: ["tableData", connectionId] });

      // Also refresh the schema list in the sidebar
      const projectStore = useProjectStore.getState();
      projectStore.setProjectSchemasLoading(projectId, true);
      try {
        const raw = await invoke<SchemaWithTables[]>("get_schemas_with_tables", {
          connectionId,
        });
        projectStore.setProjectSchemas(projectId, convertSchemasWithTables(raw));
      } finally {
        projectStore.setProjectSchemasLoading(projectId, false);
      }
    },
  });
}

// Helper to get connection config - used by components that need to connect
export function getConnectionConfig(config: { host: string; port: number; database: string; username: string; password: string; ssl: boolean }) {
  return config;
}

// Secure password storage via system keychain
export async function savePassword(projectId: string, password: string): Promise<void> {
  await invoke("save_password", { projectId, password });
}

export async function getPassword(projectId: string): Promise<string> {
  return invoke<string>("get_saved_password", { connectionId: projectId });
}

export async function deletePassword(projectId: string): Promise<void> {
  await invoke("delete_password", { projectId });
}

// Commit history hooks
export function useSaveCommit() {
  return useMutation({
    mutationFn: async (params: {
      projectId: string;
      message: string;
      summary: string;
      changes: {
        type: string;
        schema_name: string;
        table_name: string;
        data: string;
        original_data: string | null;
        sql: string;
      }[];
    }) => {
      return invoke<CommitRecord>("save_commit", {
        request: {
          project_id: params.projectId,
          message: params.message,
          summary: params.summary,
          changes: params.changes,
        },
      });
    },
  });
}

export function useCommitHistory(projectId: string | null) {
  return useQuery({
    queryKey: ["commitHistory", projectId],
    queryFn: async () => {
      if (!projectId) throw new Error("No project selected");
      return invoke<CommitRecord[]>("get_commits", { projectId });
    },
    enabled: !!projectId,
  });
}

export function useCommitDetail(projectId: string | null, commitId: string | null) {
  return useQuery({
    queryKey: ["commitDetail", projectId, commitId],
    queryFn: async () => {
      if (!projectId || !commitId) throw new Error("Missing project or commit ID");
      return invoke<CommitDetail>("get_commit_detail", { projectId, commitId });
    },
    enabled: !!projectId && !!commitId,
  });
}
