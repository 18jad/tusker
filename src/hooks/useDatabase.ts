import { invoke } from "@tauri-apps/api/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Schema, TableData, Row, ConnectionConfig } from "../types";
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

interface ColumnInfo {
  name: string;
  data_type: string;
  is_nullable: boolean;
  is_primary_key: boolean;
  default_value: string | null;
}

// Fetch table data with pagination
export function useTableData(schema: string, table: string, page: number = 1) {
  const { connectionStatus } = useProjectStore();
  const pageSize = 50;

  return useQuery({
    queryKey: ["tableData", schema, table, page],
    queryFn: async () => {
      if (!currentConnectionId) throw new Error("Not connected");

      // Fetch columns first to find primary key for consistent ordering
      const columnsResult = await invoke<ColumnInfo[]>("get_columns", {
        connectionId: currentConnectionId,
        schema,
        table,
      });

      // Find primary key column(s) for consistent ordering after edits
      const primaryKeyColumn = columnsResult.find((col) => col.is_primary_key);
      const orderBy = primaryKeyColumn?.name ?? columnsResult[0]?.name;

      // Fetch data with ORDER BY to ensure consistent row ordering
      const dataResult = await invoke<PaginatedResult>("fetch_table_data", {
        request: {
          connection_id: currentConnectionId,
          schema,
          table,
          page,
          page_size: pageSize,
          order_by: orderBy,
          order_direction: "ASC",
        },
      });

      return {
        rows: dataResult.rows,
        columns: columnsResult.map((col) => ({
          name: col.name,
          dataType: col.data_type,
          isNullable: col.is_nullable,
          isPrimaryKey: col.is_primary_key,
          defaultValue: col.default_value ?? undefined,
        })),
        totalRows: dataResult.total_count,
        page: dataResult.page,
        pageSize: dataResult.page_size,
      } as TableData;
    },
    enabled: connectionStatus === "connected" && !!schema && !!table && !!currentConnectionId,
    staleTime: 30000, // 30 seconds
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
