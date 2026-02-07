import { invoke } from "@tauri-apps/api/core";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import type { Schema, TableData, Row, ConnectionConfig, SortColumn, FilterCondition } from "../types";
import { useProjectStore } from "../stores/projectStore";

// Store the current connection ID
let currentConnectionId: string | null = null;

export function getCurrentConnectionId() {
  return currentConnectionId;
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

interface SchemaInfo {
  name: string;
  owner: string;
}

interface TableInfo {
  name: string;
  schema: string;
  row_count: number;
}

// Connect to database
export function useConnect() {
  const { setConnectionStatus, setSchemas, setSchemasLoading, setError, getActiveProject } = useProjectStore();

  return useMutation({
    mutationFn: async (config: ConnectionConfig) => {
      setConnectionStatus("connecting");
      setSchemas([]); // Clear stale schemas from previous connection
      setSchemasLoading(false);
      setError(null);

      const activeProject = getActiveProject();

      // Fetch password from secure keychain if not provided
      let password = config.password;
      if (!password && activeProject) {
        try {
          password = await invoke<string>("get_saved_password", { connectionId: activeProject.id });
        } catch {
          // No saved password, will try with empty (may fail auth)
          password = "";
        }
      }

      const request: ConnectRequest = {
        name: activeProject?.name || "connection",
        host: config.host,
        port: config.port,
        database: config.database,
        username: config.username,
        password,
        ssl_mode: config.ssl ? "require" : "disable",
        save_connection: false,
      };

      const result = await invoke<ConnectResponse>("connect", { request });
      currentConnectionId = result.connection_id;
      return result;
    },
    onSuccess: async (result) => {
      setConnectionStatus("connected");
      setError(null);
      setSchemasLoading(true);

      // Fetch schemas after connecting
      try {
        const schemaInfos = await invoke<SchemaInfo[]>("get_schemas", {
          connectionId: result.connection_id,
        });

        // Convert to our Schema type with tables
        const schemasWithTables: Schema[] = await Promise.all(
          schemaInfos
            .filter((s) => !s.name.startsWith("pg_") && s.name !== "information_schema")
            .map(async (schemaInfo) => {
              const tables = await invoke<TableInfo[]>("get_tables", {
                connectionId: result.connection_id,
                schema: schemaInfo.name,
              });

              return {
                name: schemaInfo.name,
                tables: tables.map((t) => ({
                  name: t.name,
                  schema: t.schema,
                  rowCount: t.row_count,
                })),
              };
            })
        );

        setSchemas(schemasWithTables);
      } catch (err) {
        console.error("Failed to fetch schemas:", err);
      } finally {
        setSchemasLoading(false);
      }
    },
    onError: (error: Error) => {
      setConnectionStatus("error");
      setError(error.message || "Failed to connect to database");
      currentConnectionId = null;
    },
  });
}

// Disconnect from database
export function useDisconnect() {
  const { setConnectionStatus, setSchemas, setSchemasLoading, setError } = useProjectStore();

  return useMutation({
    mutationFn: async () => {
      if (currentConnectionId) {
        await invoke("disconnect", { connectionId: currentConnectionId });
        currentConnectionId = null;
      }
    },
    onSuccess: () => {
      setConnectionStatus("disconnected");
      setSchemas([]);
      setSchemasLoading(false);
      setError(null);
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });
}

// Test connection
export function useTestConnection() {
  return useMutation({
    mutationFn: async (config: ConnectionConfig) => {
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
export function useSchemas() {
  const { connectionStatus } = useProjectStore();

  return useQuery({
    queryKey: ["schemas"],
    queryFn: async () => {
      if (!currentConnectionId) throw new Error("Not connected");

      const schemaInfos = await invoke<SchemaInfo[]>("get_schemas", {
        connectionId: currentConnectionId,
      });

      const schemasWithTables: Schema[] = await Promise.all(
        schemaInfos
          .filter((s) => !s.name.startsWith("pg_") && s.name !== "information_schema")
          .map(async (schemaInfo) => {
            const tables = await invoke<TableInfo[]>("get_tables", {
              connectionId: currentConnectionId,
              schema: schemaInfo.name,
            });

            return {
              name: schemaInfo.name,
              tables: tables.map((t) => ({
                name: t.name,
                schema: t.schema,
                rowCount: t.row_count,
              })),
            };
          })
      );

      return schemasWithTables;
    },
    enabled: connectionStatus === "connected" && !!currentConnectionId,
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
export function useTableColumns(schema: string, table: string) {
  const { connectionStatus } = useProjectStore();

  return useQuery({
    queryKey: ["tableColumns", schema, table],
    queryFn: async () => {
      if (!currentConnectionId) throw new Error("Not connected");
      return invoke<FullColumnInfo[]>("get_columns", {
        connectionId: currentConnectionId,
        schema,
        table,
      });
    },
    enabled: connectionStatus === "connected" && !!schema && !!table && !!currentConnectionId,
  });
}

// Fetch table data with pagination and sorting
export function useTableData(
  schema: string,
  table: string,
  page: number = 1,
  sorts: SortColumn[] = [],
  filters: FilterCondition[] = [],
) {
  const { connectionStatus } = useProjectStore();
  const pageSize = 50;
  // Stable keys for React Query cache
  const sortKey = JSON.stringify(sorts);
  const filterKey = JSON.stringify(filters);

  return useQuery({
    queryKey: ["tableData", schema, table, page, sortKey, filterKey],
    queryFn: async () => {
      if (!currentConnectionId) throw new Error("Not connected");

      // Fetch columns first to find primary key for consistent ordering
      const columnsResult = await invoke<ColumnInfo[]>("get_columns", {
        connectionId: currentConnectionId,
        schema,
        table,
      });

      // Build order arrays: use custom sorts if provided, otherwise fall back to PK ordering
      let orderByColumns: string[];
      let orderDirections: string[];

      if (sorts.length > 0) {
        orderByColumns = sorts.map((s) => s.column);
        orderDirections = sorts.map((s) => s.direction);
      } else {
        const primaryKeyColumn = columnsResult.find((col) => col.is_primary_key);
        const fallbackCol = primaryKeyColumn?.name || columnsResult[0]?.name;
        orderByColumns = fallbackCol ? [fallbackCol] : [];
        orderDirections = fallbackCol ? ["ASC"] : [];
      }

      // Fetch data with ORDER BY to ensure consistent row ordering
      const dataResult = await invoke<PaginatedResult>("fetch_table_data", {
        request: {
          connection_id: currentConnectionId,
          schema,
          table,
          page,
          page_size: pageSize,
          order_by: orderByColumns.length > 0 ? orderByColumns : undefined,
          order_direction: orderDirections.length > 0 ? orderDirections : undefined,
          filters: filters.length > 0 ? filters : undefined,
        },
      });

      return {
        rows: dataResult.rows,
        columns: columnsResult.map((col) => ({
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
    enabled: connectionStatus === "connected" && !!schema && !!table && !!currentConnectionId,
    staleTime: 30000, // 30 seconds
    placeholderData: keepPreviousData, // Show old data while sort/page change fetches
  });
}

// Insert row
export function useInsertRow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { schema: string; table: string; data: Row }) => {
      if (!currentConnectionId) throw new Error("Not connected");
      await invoke("insert_row", {
        connectionId: currentConnectionId,
        schema: params.schema,
        table: params.table,
        data: params.data,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tableData", variables.schema, variables.table],
      });
    },
  });
}

// Update row
export function useUpdateRow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { schema: string; table: string; data: Row; where: Row }) => {
      if (!currentConnectionId) throw new Error("Not connected");
      await invoke("update_row", {
        connectionId: currentConnectionId,
        schema: params.schema,
        table: params.table,
        data: params.data,
        whereClause: params.where,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tableData", variables.schema, variables.table],
      });
    },
  });
}

// Delete row
export function useDeleteRow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { schema: string; table: string; where: Row }) => {
      if (!currentConnectionId) throw new Error("Not connected");
      await invoke("delete_row", {
        connectionId: currentConnectionId,
        schema: params.schema,
        table: params.table,
        whereClause: params.where,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tableData", variables.schema, variables.table],
      });
    },
  });
}

// Execute raw SQL
export function useExecuteQuery() {
  return useMutation({
    mutationFn: async (query: string) => {
      if (!currentConnectionId) throw new Error("Not connected");
      const result = await invoke<TableData>("execute_query", {
        connectionId: currentConnectionId,
        sql: query,
      });
      return result;
    },
  });
}

// Fetch foreign key reference values for a column
export function useForeignKeyValues(
  schema: string,
  table: string,
  column: string,
  searchQuery: string = "",
  limit: number = 100
) {
  const { connectionStatus } = useProjectStore();

  return useQuery({
    queryKey: ["fkValues", schema, table, column, searchQuery, limit],
    queryFn: async () => {
      if (!currentConnectionId) throw new Error("Not connected");

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
        connectionId: currentConnectionId,
        sql: searchQuery ? sql.replace("$1", `'${searchQuery.replace(/'/g, "''")}'`) : sql,
      });

      // Extract the column values
      return result.rows.map((row) => row[column]);
    },
    enabled: connectionStatus === "connected" && !!schema && !!table && !!column,
    staleTime: 30000, // Cache for 30 seconds
  });
}

// Commit staged changes - execute multiple queries in sequence
export function useCommitChanges() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (queries: string[]) => {
      if (!currentConnectionId) throw new Error("Not connected");
      // Execute each query in sequence
      for (const query of queries) {
        await invoke("execute_query", {
          connectionId: currentConnectionId,
          sql: query,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tableData"] });
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
  const { setSchemas, setSchemasLoading } = useProjectStore.getState();

  return useMutation({
    mutationFn: async (params: {
      statements: string[];
      dry_run: boolean;
      lock_timeout_ms?: number;
      statement_timeout_ms?: number;
    }) => {
      if (!currentConnectionId) throw new Error("Not connected");
      return invoke<MigrationResult>("execute_migration", {
        request: {
          connection_id: currentConnectionId,
          statements: params.statements,
          dry_run: params.dry_run,
          lock_timeout_ms: params.lock_timeout_ms,
          statement_timeout_ms: params.statement_timeout_ms,
        },
      });
    },
    onSuccess: async (result) => {
      // Only refresh schemas if we actually committed changes
      if (result.committed) {
        queryClient.invalidateQueries({ queryKey: ["tableData"] });
        queryClient.invalidateQueries({ queryKey: ["tableColumns"] });

        if (currentConnectionId) {
          setSchemasLoading(true);
          try {
            const schemaInfos = await invoke<SchemaInfo[]>("get_schemas", {
              connectionId: currentConnectionId,
            });

            const schemasWithTables: Schema[] = await Promise.all(
              schemaInfos
                .filter((s) => !s.name.startsWith("pg_") && s.name !== "information_schema")
                .map(async (schemaInfo) => {
                  const tables = await invoke<TableInfo[]>("get_tables", {
                    connectionId: currentConnectionId,
                    schema: schemaInfo.name,
                  });

                  return {
                    name: schemaInfo.name,
                    tables: tables.map((t) => ({
                      name: t.name,
                      schema: t.schema,
                      rowCount: t.row_count,
                    })),
                  };
                })
            );

            setSchemas(schemasWithTables);
          } finally {
            setSchemasLoading(false);
          }
        }
      }
    },
  });
}

// Execute a single SQL statement (for DDL like CREATE TABLE)
export function useExecuteSQL() {
  const queryClient = useQueryClient();
  const { setSchemas, setSchemasLoading } = useProjectStore.getState();

  return useMutation({
    mutationFn: async (params: { sql: string }) => {
      if (!currentConnectionId) throw new Error("Not connected");
      await invoke("execute_query", {
        connectionId: currentConnectionId,
        sql: params.sql,
      });
    },
    onSuccess: async () => {
      // Refresh schemas to show new/modified tables
      queryClient.invalidateQueries({ queryKey: ["tableData"] });

      // Also refresh the schema list in the sidebar
      if (currentConnectionId) {
        setSchemasLoading(true);
        try {
          const schemaInfos = await invoke<SchemaInfo[]>("get_schemas", {
            connectionId: currentConnectionId,
          });

          // Convert to our Schema type with tables (same pattern as connect)
          const schemasWithTables: Schema[] = await Promise.all(
            schemaInfos
              .filter((s) => !s.name.startsWith("pg_") && s.name !== "information_schema")
              .map(async (schemaInfo) => {
                const tables = await invoke<TableInfo[]>("get_tables", {
                  connectionId: currentConnectionId,
                  schema: schemaInfo.name,
                });

                return {
                  name: schemaInfo.name,
                  tables: tables.map((t) => ({
                    name: t.name,
                    schema: t.schema,
                    rowCount: t.row_count,
                  })),
                };
              })
          );

          setSchemas(schemasWithTables);
        } finally {
          setSchemasLoading(false);
        }
      }
    },
  });
}

// Helper to get connection config - used by components that need to connect
export function getConnectionConfig(config: ConnectionConfig): ConnectionConfig {
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
