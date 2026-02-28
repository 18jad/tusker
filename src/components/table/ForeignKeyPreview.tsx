import { useState, useEffect } from "react";
import { ExternalLink, Loader2, AlertCircle, X, Key, Hash, Type, Calendar, ToggleLeft, Braces, ClipboardCopy, Copy } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "../../lib/utils";
import { getCurrentConnectionId } from "../../hooks/useDatabase";
import { ContextMenu } from "../ui/ContextMenu";
import { useUIStore } from "../../stores/uiStore";
import type { ForeignKeyInfo, CellValue, Column, Row, Tab } from "../../types";

interface ColumnInfoRaw {
  name: string;
  data_type: string;
  is_nullable: boolean;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  foreign_key_info: {
    constraint_name: string;
    referenced_schema: string;
    referenced_table: string;
    referenced_column: string;
  } | null;
  default_value: string | null;
  enum_values: string[] | null;
}

function mapColumns(raw: ColumnInfoRaw[]): Column[] {
  return raw.map((col) => ({
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
  }));
}

function getTypeIcon(dataType: string) {
  const type = dataType.toLowerCase();
  if (type.includes("int") || type.includes("numeric") || type.includes("decimal") || type.includes("float") || type.includes("double")) {
    return <Hash className="w-3 h-3" />;
  }
  if (type.includes("bool")) {
    return <ToggleLeft className="w-3 h-3" />;
  }
  if (type.includes("date") || type.includes("time")) {
    return <Calendar className="w-3 h-3" />;
  }
  if (type.includes("json")) {
    return <Braces className="w-3 h-3" />;
  }
  return <Type className="w-3 h-3" />;
}

function formatCellValue(value: CellValue): string {
  if (value === null) return "";
  if (value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") {
    const json = JSON.stringify(value);
    return json.length > 100 ? json.slice(0, 100) + "…" : json;
  }
  const str = String(value);
  return str.length > 100 ? str.slice(0, 100) + "…" : str;
}

interface ForeignKeySubRowProps {
  value: CellValue;
  foreignKeyInfo: ForeignKeyInfo;
  colSpan: number;
  onClose: () => void;
}

/**
 * Read-only modal to view a full cell value. Shown on double-click.
 */
function CellValueViewer({
  columnName,
  dataType,
  value,
  onClose,
}: {
  columnName: string;
  dataType: string;
  value: string;
  onClose: () => void;
}) {
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    useUIStore.getState().showToast("Value copied to clipboard", "info");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className={cn(
          "w-[500px] max-w-[90vw] max-h-[70vh] flex flex-col",
          "bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-[4px] shadow-xl"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-color)] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-[var(--text-primary)] truncate">
              {columnName}
            </span>
            <span className="text-xs text-[var(--text-muted)]">({dataType})</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Value */}
        <div className="flex-1 overflow-auto min-h-0 p-4">
          <pre className="text-sm text-[var(--text-primary)] whitespace-pre-wrap break-all font-mono select-text">
            {value}
          </pre>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--border-color)] shrink-0">
          <span className="text-[10px] text-[var(--text-muted)]">
            {value.length} characters • Escape to close
          </span>
          <button
            onClick={handleCopy}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 text-xs rounded",
              "bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
            )}
          >
            <ClipboardCopy className="w-3 h-3" />
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline sub-row that renders the related FK record as a real scrollable table,
 * matching the same visual style as the parent DataTable.
 */
export function ForeignKeySubRow({
  value,
  foreignKeyInfo,
  colSpan,
  onClose,
}: ForeignKeySubRowProps) {
  const [columns, setColumns] = useState<Column[]>([]);
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCell, setExpandedCell] = useState<{ col: string; value: string; dataType: string } | null>(null);

  useEffect(() => {
    const connectionId = getCurrentConnectionId();
    if (!connectionId) {
      setError("Not connected");
      setLoading(false);
      return;
    }

    const { referencedSchema, referencedTable, referencedColumn } = foreignKeyInfo;
    const escapedValue =
      typeof value === "number" ? String(value) : `'${String(value).replace(/'/g, "''")}'`;
    const sql = `SELECT * FROM "${referencedSchema}"."${referencedTable}" WHERE "${referencedColumn}" = ${escapedValue} LIMIT 1`;

    Promise.all([
      invoke<ColumnInfoRaw[]>("get_columns", {
        connectionId,
        schema: referencedSchema,
        table: referencedTable,
      }),
      invoke<{ rows: Row[] }>("execute_query", { connectionId, sql }),
    ])
      .then(([colsRaw, dataResult]) => {
        setColumns(mapColumns(colsRaw));
        setRow(dataResult.rows[0] ?? null);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, [value, foreignKeyInfo]);

  const handleOpenInNewTab = () => {
    openRelatedTable(foreignKeyInfo, value as string | number);
    onClose();
  };

  return (
    <tr>
      <td
        colSpan={colSpan}
        className="border-b border-[var(--border-color)] p-0"
      >
        <div className="sticky left-0" style={{ width: "100cqi" }}>
          {/* Header bar */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
            <ExternalLink className="w-3 h-3 text-[var(--accent)] shrink-0" />
            <span className="text-[11px] font-medium text-[var(--text-primary)]">
              {foreignKeyInfo.referencedSchema}.{foreignKeyInfo.referencedTable}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">
              {foreignKeyInfo.referencedColumn} = {String(value)}
            </span>
            <div className="ml-auto flex items-center gap-1 shrink-0">
              <button
                onClick={handleOpenInNewTab}
                className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
              >
                <ExternalLink className="w-2.5 h-2.5" />
                Open in New Tab
              </button>
              <button
                onClick={onClose}
                className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Loading / Error / Empty */}
          {loading && (
            <div className="flex items-center gap-2 px-3 py-4 text-[var(--text-muted)]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-xs">Loading related record...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 px-3 py-3 text-red-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="text-xs">{error}</span>
            </div>
          )}

          {!loading && !error && !row && (
            <div className="px-3 py-3 text-xs text-[var(--text-muted)]">
              No matching record found
            </div>
          )}

          {/* Sub-table — same styling as DataTable */}
          {!loading && !error && row && columns.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[var(--bg-secondary)]">
                    {columns.map((column) => (
                      <th
                        key={column.name}
                        className="relative text-left border-b border-r border-[var(--border-color)] last:border-r-0"
                        style={{ width: 150, minWidth: 150 }}
                      >
                        <div className="flex flex-col px-3 py-1.5">
                          <div className="flex items-center gap-2">
                            {column.isPrimaryKey ? (
                              <Key className="w-3 h-3 flex-shrink-0 text-[var(--warning)]" />
                            ) : (
                              <span className="flex-shrink-0 text-[var(--text-muted)]">
                                {getTypeIcon(column.dataType)}
                              </span>
                            )}
                            <span className="text-xs font-medium truncate text-[var(--text-primary)]">
                              {column.name}
                            </span>
                          </div>
                          <span className="text-[10px] text-[var(--text-muted)] truncate">
                            {column.dataType}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-[var(--bg-primary)]">
                    {columns.map((column) => {
                      const val = row[column.name];
                      const isNull = val === null;
                      const rawValue = val === null ? "NULL" : typeof val === "object" ? JSON.stringify(val, null, 2) : String(val);

                      return (
                        <td
                          key={column.name}
                          className="border-b border-r border-[var(--border-color)] last:border-r-0"
                          style={{ width: 150, minWidth: 150, maxWidth: 150 }}
                        >
                          <ContextMenu
                            items={[
                              {
                                label: "Copy Value",
                                icon: <ClipboardCopy className="w-3.5 h-3.5" />,
                                onClick: () => {
                                  navigator.clipboard.writeText(rawValue);
                                  useUIStore.getState().showToast("Value copied to clipboard", "info");
                                },
                              },
                              {
                                label: "Copy Column Name",
                                icon: <Copy className="w-3.5 h-3.5" />,
                                onClick: () => {
                                  navigator.clipboard.writeText(column.name);
                                  useUIStore.getState().showToast("Column name copied", "info");
                                },
                              },
                            ]}
                          >
                            <div
                              className="px-3 py-2 text-sm h-full flex items-center gap-1 select-text overflow-hidden text-ellipsis whitespace-nowrap cursor-default"
                              onDoubleClick={() => {
                                setExpandedCell({ col: column.name, value: rawValue, dataType: column.dataType });
                              }}
                            >
                              {isNull ? (
                                <span className="text-[var(--text-muted)] italic text-xs">NULL</span>
                              ) : (
                                <span className="text-[var(--text-primary)]" title={String(val)}>
                                  {formatCellValue(val)}
                                </span>
                              )}
                            </div>
                          </ContextMenu>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {expandedCell && (
          <CellValueViewer
            columnName={expandedCell.col}
            dataType={expandedCell.dataType}
            value={expandedCell.value}
            onClose={() => setExpandedCell(null)}
          />
        )}
      </td>
    </tr>
  );
}

/**
 * Opens a new tab for the referenced table with a pre-set filter.
 */
export function openRelatedTable(
  foreignKeyInfo: ForeignKeyInfo,
  value: string | number,
  connectionId?: string,
  projectId?: string
) {
  const { referencedSchema, referencedTable, referencedColumn } = foreignKeyInfo;
  const filterKey = `${referencedSchema}.${referencedTable}:fk:${referencedColumn}=${value}`;

  const store = useUIStore.getState();
  const resolvedConnectionId = connectionId ?? store.getActiveConnectionId() ?? "";
  const resolvedProjectId = projectId ?? store.getActiveProjectId() ?? "";

  const newTab: Tab = {
    id: `table-fk-${Date.now()}`,
    type: "table",
    title: `${referencedTable} [${referencedColumn}=${value}]`,
    connectionId: resolvedConnectionId,
    projectId: resolvedProjectId,
    schema: referencedSchema,
    table: referencedTable,
    filterKey,
  };

  store.addTab(newTab);

  store.setTableFilters(filterKey, [
    {
      column: referencedColumn,
      operator: "equals",
      value: String(value),
    },
  ]);
}
