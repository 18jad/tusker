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
  const { setConnectionStatus, setSchemas, setError, getActiveProject } = useProjectStore();

  return useMutation({
    mutationFn: async (config: ConnectionConfig) => {
      setConnectionStatus("connecting");
      setError(null);

      const request: ConnectRequest = {
        name: getActiveProject()?.name || "connection",
        host: config.host,
        port: config.port,
        database: config.database,
        username: config.username,
        password: config.password,
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
  const { setConnectionStatus, setSchemas, setError } = useProjectStore();

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

      // Fetch columns and data in parallel
      const [columnsResult, dataResult] = await Promise.all([
        invoke<ColumnInfo[]>("get_columns", {
          connectionId: currentConnectionId,
          schema,
          table,
        }),
        invoke<PaginatedResult>("fetch_table_data", {
          request: {
            connection_id: currentConnectionId,
            schema,
            table,
            page,
            page_size: pageSize,
          },
        }),
      ]);

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
