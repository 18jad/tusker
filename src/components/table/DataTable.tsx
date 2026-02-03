import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/uiStore";
import type { Column, Row, CellValue } from "../../types";
import { Key, Hash, Type, Calendar, ToggleLeft } from "lucide-react";

interface DataTableProps {
  tableKey: string;
  columns: Column[];
  rows: Row[];
  selectedRowIndex?: number | null;
  onRowSelect?: (index: number) => void;
  onCellEdit?: (rowIndex: number, columnName: string, value: CellValue) => void;
  editedCells?: Set<string>;
  readOnly?: boolean;
}

/**
 * Get icon for column data type
 */
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
  return <Type className="w-3 h-3" />;
}

/**
 * Format cell value for display
 */
function formatCellValue(value: CellValue): string {
  if (value === null) return "";
  if (value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Parse string value back to appropriate type
 */
function parseValue(value: string, dataType: string): CellValue {
  if (value === "" || value.toLowerCase() === "null") return null;

  const type = dataType.toLowerCase();
  if (type.includes("int")) {
    const num = parseInt(value, 10);
    return isNaN(num) ? value : num;
  }
  if (type.includes("float") || type.includes("double") || type.includes("numeric") || type.includes("decimal")) {
    const num = parseFloat(value);
    return isNaN(num) ? value : num;
  }
  if (type.includes("bool")) {
    return value.toLowerCase() === "true";
  }
  return value;
}

/**
 * Editable cell component
 */
function EditableCell({
  value,
  column,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  readOnly,
  isEdited = false,
}: {
  value: CellValue;
  column: Column;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (value: CellValue) => void;
  onCancel: () => void;
  readOnly: boolean;
  isEdited?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editValue, setEditValue] = useState(formatCellValue(value));

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(formatCellValue(value));
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSave(parseValue(editValue, column.dataType));
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditValue(formatCellValue(value));
      onCancel();
    }
  };

  const handleBlur = () => {
    // Save on blur
    onSave(parseValue(editValue, column.dataType));
  };

  const isNull = value === null;
  const displayValue = isNull ? "NULL" : formatCellValue(value);

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 px-1 py-1 h-full">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className={cn(
            "flex-1 px-2 py-1 text-sm rounded",
            "bg-[var(--bg-primary)] text-[var(--text-primary)]",
            "border border-[var(--accent)] outline-none",
            "focus:ring-1 focus:ring-[var(--accent)]"
          )}
          placeholder={column.isNullable ? "NULL" : ""}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "px-3 py-2 truncate text-sm h-full flex items-center gap-1",
        !readOnly && "cursor-text"
      )}
      onDoubleClick={() => !readOnly && onStartEdit()}
    >
      {isEdited && (
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)] shrink-0" title="Modified" />
      )}
      {isNull ? (
        <span className="text-[var(--text-muted)] italic text-xs">NULL</span>
      ) : (
        <span className={cn("text-[var(--text-primary)]", isEdited && "text-[var(--warning)]")}>
          {displayValue}
        </span>
      )}
    </div>
  );
}

/**
 * Clean, modern data table with inline editing
 */
export function DataTable({
  tableKey,
  columns,
  rows,
  selectedRowIndex = null,
  onRowSelect,
  onCellEdit,
  editedCells = new Set(),
  readOnly = false,
}: DataTableProps) {
  const allColumnWidths = useUIStore((state) => state.columnWidths);
  const setColumnWidth = useUIStore((state) => state.setColumnWidth);
  const [resizing, setResizing] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);

  const columnWidths = allColumnWidths[tableKey] || {};
  const getColumnWidth = (colName: string) => columnWidths[colName] || 180;

  const handleResizeStart = useCallback((colName: string, e: React.MouseEvent) => {
    e.preventDefault();
    setResizing(colName);
    const startX = e.clientX;
    const startWidth = getColumnWidth(colName);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(80, Math.min(500, startWidth + delta));
      setColumnWidth(tableKey, colName, newWidth);
    };

    const handleMouseUp = () => {
      setResizing(null);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [tableKey, columnWidths, setColumnWidth]);

  const handleStartEdit = (rowIndex: number, colName: string) => {
    setEditingCell({ row: rowIndex, col: colName });
  };

  const handleSaveEdit = (rowIndex: number, colName: string, value: CellValue) => {
    const originalValue = rows[rowIndex][colName];
    // Only trigger edit if value actually changed
    if (value !== originalValue) {
      onCellEdit?.(rowIndex, colName, value);
    }
    setEditingCell(null);
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
  };

  if (columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
        No columns to display
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full border-collapse">
        {/* Header */}
        <thead className="sticky top-0 z-10">
          <tr className="bg-[var(--bg-secondary)]">
            {columns.map((column) => (
              <th
                key={column.name}
                className="relative text-left border-b border-r border-[var(--border-color)] last:border-r-0"
                style={{ width: getColumnWidth(column.name), minWidth: getColumnWidth(column.name) }}
              >
                <div className="flex items-center gap-2 px-3 py-2">
                  {column.isPrimaryKey ? (
                    <Key className="w-3 h-3 text-[var(--warning)]" />
                  ) : (
                    <span className="text-[var(--text-muted)]">{getTypeIcon(column.dataType)}</span>
                  )}
                  <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                    {column.name}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] opacity-60">
                    {column.dataType}
                  </span>
                </div>
                {/* Resize handle */}
                <div
                  className={cn(
                    "absolute top-0 right-0 w-1 h-full cursor-col-resize",
                    "hover:bg-[var(--accent)] transition-colors",
                    resizing === column.name && "bg-[var(--accent)]"
                  )}
                  onMouseDown={(e) => handleResizeStart(column.name, e)}
                />
              </th>
            ))}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {rows.map((row, rowIndex) => {
            const isSelected = selectedRowIndex === rowIndex;
            const isEven = rowIndex % 2 === 0;

            return (
              <tr
                key={rowIndex}
                onClick={() => onRowSelect?.(rowIndex)}
                className={cn(
                  "transition-colors",
                  isEven ? "bg-[var(--bg-primary)]" : "bg-[var(--bg-secondary)]/30",
                  isSelected && "!bg-[var(--accent)]/10",
                  "hover:bg-[var(--bg-tertiary)]"
                )}
              >
                {columns.map((column) => {
                  const value = row[column.name];
                  const isEditing = editingCell?.row === rowIndex && editingCell?.col === column.name;
                  const cellKey = `${rowIndex}:${column.name}`;
                  const isEdited = editedCells.has(cellKey);

                  return (
                    <td
                      key={column.name}
                      className={cn(
                        "border-b border-r border-[var(--border-color)] last:border-r-0",
                        isEditing && "p-0",
                        isEdited && "bg-[var(--warning)]/10"
                      )}
                      style={{
                        width: getColumnWidth(column.name),
                        minWidth: getColumnWidth(column.name),
                        maxWidth: getColumnWidth(column.name)
                      }}
                    >
                      <EditableCell
                        value={value}
                        column={column}
                        isEditing={isEditing}
                        onStartEdit={() => handleStartEdit(rowIndex, column.name)}
                        onSave={(newValue) => handleSaveEdit(rowIndex, column.name, newValue)}
                        onCancel={handleCancelEdit}
                        readOnly={readOnly}
                        isEdited={isEdited}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
        </table>
      </div>

      {/* Edit hint - outside scroll container */}
      {!readOnly && (
        <div className="shrink-0 px-3 py-1.5 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] text-[10px] text-[var(--text-muted)]">
          Double-click to edit • Enter to save • Escape to cancel
        </div>
      )}
    </div>
  );
}
