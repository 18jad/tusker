import { useState, useCallback } from "react";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Eye,
  Trash2,
  Columns,
  Plus,
  Table2,
  MoreVertical,
  Copy,
  Code,
  FileSpreadsheet,
  FileJson,
  Upload,
  Eraser,
  DatabaseZap,
} from "lucide-react";
import { Popover } from "../ui/Popover";
import type { CellValue, TableData, SortColumn, FilterCondition } from "../../types";
import { DataTable } from "./DataTable";
import { Pagination } from "./Pagination";
import { SortPopover } from "./SortPopover";
import { FilterButton, FilterPanel } from "./FilterPopover";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/uiStore";
import { exportTable } from "../../lib/exportTable";

interface TableViewProps {
  connectionId?: string;
  tableKey: string;
  schemaName: string;
  tableName: string;
  data: TableData | null;
  isLoading: boolean;
  isFetching?: boolean;
  error: string | null;
  onPageChange: (page: number) => void;
  onCellEdit?: (rowIndex: number, columnName: string, value: CellValue) => void;
  onRowView?: (rowIndex: number) => void;
  onRowDelete?: (rowIndex: number) => void;
  onRowsDelete?: (rowIndices: number[]) => void;
  onRefresh?: () => void;
  onAddRow?: () => void;
  onDeleteTable?: () => void;
  onImportCSV?: () => void;
  onImportJSON?: () => void;
  onTruncateTable?: () => void;
  editedCells?: Set<string>;
  deletedRows?: Set<number>;
  readOnly?: boolean;
  sorts?: SortColumn[];
  onSort?: (columnName: string, addToSort: boolean) => void;
  onSortsChange?: (sorts: SortColumn[]) => void;
  filters?: FilterCondition[];
  onFiltersChange?: (filters: FilterCondition[]) => void;
  onReset?: () => void;
}

function SkeletonRow({ columns, rowNum }: { columns: number; rowNum: number }) {
  return (
    <tr className="border-b border-[var(--border-color)]">
      {/* Row number */}
      <td
        className="text-center border-r border-[var(--border-color)] text-xs text-[var(--text-muted)] sticky left-0 bg-[var(--bg-primary)]"
        style={{ width: 50, minWidth: 50 }}
      >
        {rowNum}
      </td>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div
            className={cn(
              "h-4 rounded bg-[var(--bg-tertiary)] animate-pulse",
              i === 0 ? "w-16" : "w-full max-w-[120px]"
            )}
          />
        </td>
      ))}
    </tr>
  );
}

function SkeletonTable() {
  const columnCount = 5;
  const rowCount = 12;

  return (
    <div className="h-full overflow-hidden">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-20">
          <tr className="bg-[var(--bg-secondary)]">
            {/* Row number header */}
            <th
              className="text-center border-b border-r border-[var(--border-color)] sticky left-0 z-30 bg-[var(--bg-secondary)]"
              style={{ width: 50, minWidth: 50 }}
            >
              <span className="text-[10px] text-[var(--text-muted)]">#</span>
            </th>
            {Array.from({ length: columnCount }).map((_, i) => (
              <th
                key={i}
                className="text-left border-b border-r border-[var(--border-color)] last:border-r-0 px-3 py-2"
                style={{ width: 180 }}
              >
                <div className="h-3 w-20 rounded bg-[var(--bg-tertiary)] animate-pulse" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }).map((_, i) => (
            <SkeletonRow key={i} columns={columnCount} rowNum={i + 1} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TableView({
  connectionId,
  tableKey,
  schemaName,
  tableName,
  data,
  isLoading,
  isFetching = false,
  error,
  onPageChange,
  onCellEdit,
  onRowView,
  onRowDelete,
  onRowsDelete,
  onRefresh,
  onAddRow,
  onDeleteTable,
  onImportCSV,
  onImportJSON,
  onTruncateTable,
  editedCells,
  deletedRows,
  readOnly = false,
  sorts = [],
  onSort,
  onSortsChange,
  filters = [],
  onFiltersChange,
  onReset,
}: TableViewProps) {
  const showToast = useUIStore((state) => state.showToast);
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  const handleRemoveFilter = useCallback(
    (index: number) => {
      if (!onFiltersChange) return;
      const next = filters.filter((_, i) => i !== index);
      onFiltersChange(next);
    },
    [filters, onFiltersChange],
  );

  const handleRowSelect = useCallback((index: number, modifiers: { shift: boolean; ctrl: boolean }) => {
    setSelectedRowIndices((prev) => {
      const next = new Set(prev);

      if (modifiers.shift && lastSelectedIndex !== null && data) {
        // Range selection: select all rows between last selected and current
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        for (let i = start; i <= end; i++) {
          next.add(i);
        }
      } else if (modifiers.ctrl) {
        // Toggle selection: add or remove the clicked row
        if (next.has(index)) {
          next.delete(index);
        } else {
          next.add(index);
        }
      } else {
        // Simple click: select only this row (or deselect if already selected alone)
        if (next.size === 1 && next.has(index)) {
          next.clear();
        } else {
          next.clear();
          next.add(index);
        }
      }

      return next;
    });

    // Update last selected index for shift-click range selection
    if (!modifiers.shift) {
      setLastSelectedIndex(index);
    }
  }, [lastSelectedIndex, data]);

  const handleCellEdit = useCallback(
    (rowIndex: number, columnName: string, value: CellValue) => {
      onCellEdit?.(rowIndex, columnName, value);
    },
    [onCellEdit]
  );

  const handleRowView = useCallback(
    (rowIndex: number) => {
      onRowView?.(rowIndex);
    },
    [onRowView]
  );

  const handleRowDelete = useCallback(
    (rowIndex: number) => {
      onRowDelete?.(rowIndex);
      setSelectedRowIndices(new Set());
      setLastSelectedIndex(null);
    },
    [onRowDelete]
  );

  const handleMultiRowDelete = useCallback(() => {
    if (selectedRowIndices.size === 0) return;

    // Filter out already deleted rows
    const indicesToDelete = Array.from(selectedRowIndices).filter(
      (idx) => !deletedRows?.has(idx)
    );

    if (indicesToDelete.length === 0) return;

    onRowsDelete?.(indicesToDelete);
    setSelectedRowIndices(new Set());
    setLastSelectedIndex(null);
  }, [selectedRowIndices, deletedRows, onRowsDelete]);

  // Loading state - show skeleton
  if (isLoading && !data) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 min-h-0">
          <SkeletonTable />
        </div>
        <div className="h-10 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] flex items-center justify-center">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Loading {tableName}...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    const hasFiltersOrSorts = filters.length > 0 || sorts.length > 0;

    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-[4px] bg-[var(--bg-secondary)] border border-[var(--border-color)] overflow-hidden">
          {/* Red accent bar */}
          <div className="h-1 bg-gradient-to-r from-red-500 to-red-600" />

          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-[4px] bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle className="w-4 h-4 text-red-400" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[13px] font-medium text-[var(--text-primary)]">
                  Failed to load {tableName}
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed break-words">
                  {error}
                </p>
              </div>
            </div>

            <div className={cn("flex gap-2", hasFiltersOrSorts ? "flex-col" : "")}>
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className={cn(
                    "w-full h-8 rounded-[4px] text-xs font-medium",
                    "flex items-center justify-center gap-1.5",
                    "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
                    "hover:bg-[#2a2a2a] hover:text-[var(--text-primary)]",
                    "transition-colors"
                  )}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry
                </button>
              )}

              {hasFiltersOrSorts && onReset && (
                <button
                  onClick={onReset}
                  className={cn(
                    "w-full h-8 rounded-[4px] text-xs font-medium",
                    "flex items-center justify-center gap-1.5",
                    "text-red-400 hover:bg-red-500/10",
                    "transition-colors"
                  )}
                >
                  <Eraser className="w-3.5 h-3.5" />
                  Clear filters & retry
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No data
  if (!data) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 max-w-xs text-center">
          <div className="w-16 h-16 rounded-[4px] bg-[var(--bg-tertiary)] border border-[var(--border-color)] flex items-center justify-center">
            <DatabaseZap className="w-7 h-7 text-[var(--text-muted)]" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-1">
              No data available
            </h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Could not load data for <span className="font-medium text-[var(--text-secondary)]">{tableName}</span>. The table may be empty, or the connection was interrupted.
            </p>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className={cn(
                "h-8 px-4 rounded-[4px] text-xs font-medium",
                "flex items-center gap-1.5",
                "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
                "hover:bg-[#2a2a2a] hover:text-[var(--text-primary)]",
                "border border-[var(--border-color)]",
                "transition-colors"
              )}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(data.totalRows / data.pageSize));

  return (
    <div className="flex flex-col h-full">
      {/* Table toolbar */}
      <div className="flex items-center justify-between px-3 h-10 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] shrink-0">
        {/* Left side - Row actions when selected */}
        <div className="flex items-center gap-1">
          {selectedRowIndices.size > 0 && !readOnly ? (
            selectedRowIndices.size === 1 ? (
              // Single row selected - show View and Delete
              (() => {
                const selectedIndex = Array.from(selectedRowIndices)[0];
                return (
                  <>
                    <button
                      onClick={() => handleRowView(selectedIndex)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] text-xs",
                        "text-[var(--accent)] hover:text-[var(--accent)]",
                        "hover:bg-[var(--accent)]/10 transition-colors"
                      )}
                      title="View/Edit row"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>

                    {!deletedRows?.has(selectedIndex) && (
                      <button
                        onClick={() => handleRowDelete(selectedIndex)}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] text-xs",
                          "text-red-400 hover:text-red-300",
                          "hover:bg-red-500/10 transition-colors"
                        )}
                        title="Delete row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}

                    <span className="text-xs text-[var(--text-muted)] ml-1">
                      Row #{(data.page - 1) * data.pageSize + selectedIndex + 1}
                    </span>
                  </>
                );
              })()
            ) : (
              // Multiple rows selected - show bulk delete
              (() => {
                const nonDeletedCount = Array.from(selectedRowIndices).filter(
                  (idx) => !deletedRows?.has(idx)
                ).length;
                return (
                  <>
                    {nonDeletedCount > 0 && (
                      <button
                        onClick={handleMultiRowDelete}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] text-xs",
                          "text-red-400 hover:text-red-300",
                          "hover:bg-red-500/10 transition-colors"
                        )}
                        title={`Delete ${nonDeletedCount} rows`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete ({nonDeletedCount} rows)</span>
                      </button>
                    )}

                    <span className="text-xs text-[var(--text-muted)] ml-1">
                      {selectedRowIndices.size} rows selected
                    </span>
                  </>
                );
              })()
            )
          ) : (
            <span className="text-xs text-[var(--text-muted)]">
              Click a row to select
            </span>
          )}
        </div>

        {/* Right side - Refresh & info */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">
            {data.totalRows.toLocaleString()} rows
          </span>

          {onFiltersChange && data && (
            <FilterButton
              columns={data.columns}
              filters={filters}
              isOpen={isFilterPanelOpen}
              onToggle={() => setIsFilterPanelOpen((v) => !v)}
              onRemoveFilter={handleRemoveFilter}
            />
          )}

          {onSortsChange && data && (
            <SortPopover
              columns={data.columns}
              sorts={sorts}
              onSortsChange={onSortsChange}
            />
          )}

          {onAddRow && !readOnly && (
            <button
              onClick={onAddRow}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] text-xs",
                "text-[var(--accent)] hover:text-[var(--accent)]",
                "hover:bg-[var(--accent)]/10 transition-colors"
              )}
              title="Add new row"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Row</span>
            </button>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isFetching}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] text-xs",
                "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                "hover:bg-[var(--bg-tertiary)] transition-colors",
                "disabled:opacity-50"
              )}
              title="Refresh table data (reload from database)"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 mt-px", isFetching && "animate-spin")} />
              <span>Refresh</span>
            </button>
          )}

          <Popover
            align="end"
            trigger={
              <div
                className={cn(
                  "flex items-center px-1.5 py-1.5 rounded-[4px]",
                  "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                  "hover:bg-[var(--bg-tertiary)] transition-colors"
                )}
                title="More options"
              >
                <MoreVertical className="w-4 h-4" />
              </div>
            }
            items={[
              {
                label: "Copy Name",
                icon: <Copy className="w-3.5 h-3.5" />,
                onClick: () => {
                  navigator.clipboard.writeText(`${schemaName}.${tableName}`);
                  showToast("Table name copied to clipboard");
                },
              },
              {
                label: "Copy SELECT",
                icon: <Code className="w-3.5 h-3.5" />,
                onClick: () => {
                  navigator.clipboard.writeText(`SELECT * FROM "${schemaName}"."${tableName}"`);
                  showToast("SELECT query copied to clipboard");
                },
              },
              {
                label: "Reset Layout",
                icon: <Columns className="w-3.5 h-3.5" />,
                onClick: () => useUIStore.getState().resetColumnWidths(tableKey),
              },
              { type: "separator" as const },
              {
                label: "Export as CSV",
                icon: <FileSpreadsheet className="w-3.5 h-3.5" />,
                onClick: () => {
                  if (!connectionId) return;
                  exportTable(
                    connectionId,
                    schemaName,
                    tableName,
                    "csv",
                    (message) => showToast(message),
                    (message) => showToast(message, "error")
                  );
                },
              },
              {
                label: "Export as JSON",
                icon: <FileJson className="w-3.5 h-3.5" />,
                onClick: () => {
                  if (!connectionId) return;
                  exportTable(
                    connectionId,
                    schemaName,
                    tableName,
                    "json",
                    (message) => showToast(message),
                    (message) => showToast(message, "error")
                  );
                },
              },
              ...(onImportCSV && !readOnly
                ? [
                    {
                      label: "Import from CSV",
                      icon: <Upload className="w-3.5 h-3.5" />,
                      onClick: onImportCSV,
                    },
                  ]
                : []),
              ...(onImportJSON && !readOnly
                ? [
                    {
                      label: "Import from JSON",
                      icon: <Upload className="w-3.5 h-3.5" />,
                      onClick: onImportJSON,
                    },
                  ]
                : []),
              ...(!readOnly
                ? [
                    { type: "separator" as const },
                    ...(onTruncateTable
                      ? [
                          {
                            label: "Truncate Table",
                            icon: <Eraser className="w-3.5 h-3.5" />,
                            onClick: onTruncateTable,
                            variant: "danger" as const,
                          },
                        ]
                      : []),
                    ...(onDeleteTable
                      ? [
                          {
                            label: "Delete Table",
                            icon: <Table2 className="w-3.5 h-3.5" />,
                            onClick: onDeleteTable,
                            variant: "danger" as const,
                          },
                        ]
                      : []),
                  ]
                : []),
            ]}
          />
        </div>
      </div>

      {/* Inline filter panel — slides down below toolbar */}
      {isFilterPanelOpen && onFiltersChange && data && (
        <FilterPanel
          columns={data.columns}
          filters={filters}
          onFiltersChange={onFiltersChange}
          onClose={() => setIsFilterPanelOpen(false)}
        />
      )}

      {/* Shimmer loading line */}
      {isFetching && (
        <div className="h-[1.5px] shrink-0 overflow-hidden bg-[var(--accent)]/10">
          <div className="h-full w-full animate-[shimmer_1.8s_linear_infinite] bg-[length:200%_100%] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" />
        </div>
      )}

      {/* Data table */}
      <div className="flex-1 min-h-0">
        <DataTable
          tableKey={tableKey}
          columns={data.columns}
          rows={data.rows}
          startRowNumber={(data.page - 1) * data.pageSize + 1}
          selectedRowIndices={selectedRowIndices}
          onRowSelect={handleRowSelect}
          onCellEdit={handleCellEdit}
          editedCells={editedCells}
          deletedRows={deletedRows}
          readOnly={readOnly}
          sorts={sorts}
          onSort={onSort}
        />
      </div>

      {/* Pagination */}
      <div className="border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <Pagination
          currentPage={data.page}
          totalPages={totalPages}
          pageSize={data.pageSize}
          totalRows={data.totalRows}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
}
