import { useState, useCallback } from "react";
import { Loader2, AlertCircle, RefreshCw, Eye, Trash2, Columns, Plus } from "lucide-react";
import type { CellValue, TableData } from "../../types";
import { DataTable } from "./DataTable";
import { Pagination } from "./Pagination";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/uiStore";

interface TableViewProps {
  tableKey: string;
  tableName: string;
  data: TableData | null;
  isLoading: boolean;
  error: string | null;
  onPageChange: (page: number) => void;
  onCellEdit?: (rowIndex: number, columnName: string, value: CellValue) => void;
  onRowView?: (rowIndex: number) => void;
  onRowDelete?: (rowIndex: number) => void;
  onRefresh?: () => void;
  onAddRow?: () => void;
  editedCells?: Set<string>;
  deletedRows?: Set<number>;
  readOnly?: boolean;
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
  tableKey,
  tableName,
  data,
  isLoading,
  error,
  onPageChange,
  onCellEdit,
  onRowView,
  onRowDelete,
  onRefresh,
  onAddRow,
  editedCells,
  deletedRows,
  readOnly = false,
}: TableViewProps) {
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);

  const handleRowSelect = useCallback((index: number) => {
    setSelectedRowIndex((prev) => (prev === index ? null : index));
  }, []);

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
      setSelectedRowIndex(null);
    },
    [onRowDelete]
  );

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
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <AlertCircle className="w-10 h-10 text-[var(--danger)] mx-auto mb-3" />
          <div className="text-[var(--danger)] font-medium mb-2">Failed to load data</div>
          <div className="text-sm text-[var(--text-muted)]">{error}</div>
        </div>
      </div>
    );
  }

  // No data
  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
        No data available
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
          {selectedRowIndex !== null && !readOnly ? (
            <>
              <button
                onClick={() => handleRowView(selectedRowIndex)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs",
                  "text-[var(--text-secondary)] hover:text-[var(--accent)]",
                  "hover:bg-[var(--bg-tertiary)] transition-colors"
                )}
                title="View/Edit row"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View</span>
              </button>

              {!deletedRows?.has(selectedRowIndex) && (
                <button
                  onClick={() => handleRowDelete(selectedRowIndex)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs",
                    "text-[var(--text-secondary)] hover:text-red-400",
                    "hover:bg-red-500/10 transition-colors"
                  )}
                  title="Delete row"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              )}

              <span className="text-xs text-[var(--text-muted)] ml-1">
                Row #{(data.page - 1) * data.pageSize + selectedRowIndex + 1}
              </span>
            </>
          ) : (
            <span className="text-xs text-[var(--text-muted)]">
              Click a row to select
            </span>
          )}
        </div>

        {/* Right side - Refresh & info */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--text-muted)]">
            {data.totalRows.toLocaleString()} rows
          </span>

          {onAddRow && !readOnly && (
            <button
              onClick={onAddRow}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs",
                "text-[var(--accent)] hover:text-[var(--accent)]",
                "hover:bg-[var(--accent)]/10 transition-colors"
              )}
              title="Add new row"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Row</span>
            </button>
          )}

          <button
            onClick={() => useUIStore.getState().resetColumnWidths(tableKey)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs",
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              "hover:bg-[var(--bg-tertiary)] transition-colors"
            )}
            title="Reset column widths to default"
          >
            <Columns className="w-3.5 h-3.5 mt-px" />
            <span>Reset Layout</span>
          </button>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs",
                "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                "hover:bg-[var(--bg-tertiary)] transition-colors",
                "disabled:opacity-50"
              )}
              title="Refresh table data (reload from database)"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 mt-px", isLoading && "animate-spin")} />
              <span>Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* Data table */}
      <div className="flex-1 min-h-0 relative">
        <DataTable
          tableKey={tableKey}
          columns={data.columns}
          rows={data.rows}
          startRowNumber={(data.page - 1) * data.pageSize + 1}
          selectedRowIndex={selectedRowIndex}
          onRowSelect={handleRowSelect}
          onCellEdit={handleCellEdit}
          editedCells={editedCells}
          deletedRows={deletedRows}
          readOnly={readOnly}
        />

        {/* Loading overlay for page changes */}
        {isLoading && (
          <div className="absolute inset-0 bg-[var(--bg-primary)]/70 backdrop-blur-[1px] flex items-center justify-center z-20">
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-lg">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
              <span className="text-sm text-[var(--text-secondary)]">Loading...</span>
            </div>
          </div>
        )}
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
