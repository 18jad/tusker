import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/uiStore";
import type { Column, Row, CellValue } from "../../types";
import { Key, Hash, Type, Calendar, ToggleLeft } from "lucide-react";

interface DataTableProps {
  tableKey: string;
  columns: Column[];
  rows: Row[];
  startRowNumber?: number;
  selectedRowIndex?: number | null;
  onRowSelect?: (index: number) => void;
  onCellEdit?: (rowIndex: number, columnName: string, value: CellValue) => void;
  editedCells?: Set<string>;
  deletedRows?: Set<number>;
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

// Threshold for "large" values that need special handling
const LARGE_VALUE_THRESHOLD = 500;
const DISPLAY_TRUNCATE_LENGTH = 100;

/**
 * Format cell value for display
 */
function formatCellValue(value: CellValue, truncate = false): string {
  if (value === null) return "";
  if (value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") {
    const json = JSON.stringify(value);
    if (truncate && json.length > DISPLAY_TRUNCATE_LENGTH) {
      return json.slice(0, DISPLAY_TRUNCATE_LENGTH) + "…";
    }
    return json;
  }
  const str = String(value);
  if (truncate && str.length > DISPLAY_TRUNCATE_LENGTH) {
    return str.slice(0, DISPLAY_TRUNCATE_LENGTH) + "…";
  }
  return str;
}

/**
 * Check if a value is "large" and needs special handling
 */
function isLargeValue(value: CellValue): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "object") {
    return JSON.stringify(value).length > LARGE_VALUE_THRESHOLD;
  }
  return String(value).length > LARGE_VALUE_THRESHOLD;
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
 * Large value editor modal/popover
 */
function LargeValueEditor({
  value,
  column,
  onSave,
  onCancel,
}: {
  value: CellValue;
  column: Column;
  onSave: (value: CellValue) => void;
  onCancel: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Lazy initialize to avoid freezing on mount
  const [editValue, setEditValue] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Defer the expensive string formatting
    const timer = setTimeout(() => {
      setEditValue(formatCellValue(value));
      setIsLoaded(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    if (isLoaded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isLoaded]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
    // Cmd/Ctrl+Enter to save
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSave(parseValue(editValue, column.dataType));
    }
  };

  const handleSave = () => {
    onSave(parseValue(editValue, column.dataType));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className={cn(
          "w-[600px] max-w-[90vw] max-h-[80vh] flex flex-col",
          "bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg shadow-xl"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              Edit {column.name}
            </span>
            <span className="text-xs text-[var(--text-muted)]">({column.dataType})</span>
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            {isLoaded ? `${editValue.length} characters` : "Loading..."}
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 p-4 min-h-0">
          {!isLoaded ? (
            <div className="h-[300px] flex items-center justify-center text-[var(--text-muted)]">
              Loading value...
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className={cn(
                "w-full h-[300px] p-3 text-sm font-mono rounded-md resize-none",
                "bg-[var(--bg-secondary)] text-[var(--text-primary)]",
                "border border-[var(--border-color)] outline-none",
                "focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
              )}
              placeholder={column.isNullable ? "NULL" : ""}
              spellCheck={false}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-color)]">
          <span className="text-xs text-[var(--text-muted)]">
            Cmd/Ctrl+Enter to save • Escape to cancel
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md",
                "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                "hover:bg-[var(--bg-tertiary)] transition-colors"
              )}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isLoaded}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md",
                "bg-[var(--accent)] text-white",
                "hover:opacity-90 transition-opacity",
                "disabled:opacity-50"
              )}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
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
  const isLarge = isLargeValue(value);
  const [editValue, setEditValue] = useState(() =>
    isLarge ? "" : formatCellValue(value)
  );

  useEffect(() => {
    if (isEditing && !isLarge && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing, isLarge]);

  useEffect(() => {
    if (!isLarge) {
      setEditValue(formatCellValue(value));
    }
  }, [value, isLarge]);

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
    onSave(parseValue(editValue, column.dataType));
  };

  const isNull = value === null;
  // Truncate display for large values
  const displayValue = isNull ? "NULL" : formatCellValue(value, true);

  // Large value editing - show modal
  if (isEditing && isLarge) {
    return (
      <>
        <div className={cn("px-3 py-2 truncate text-sm h-full flex items-center gap-1")}>
          {isEdited && (
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)] shrink-0" title="Modified" />
          )}
          <span className="text-[var(--text-muted)] italic text-xs">Editing...</span>
        </div>
        <LargeValueEditor
          value={value}
          column={column}
          onSave={onSave}
          onCancel={onCancel}
        />
      </>
    );
  }

  // Regular inline editing
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
      title={isLarge ? "Double-click to edit in expanded view" : undefined}
    >
      {isEdited && (
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)] shrink-0" title="Modified" />
      )}
      {isNull ? (
        <span className="text-[var(--text-muted)] italic text-xs">NULL</span>
      ) : (
        <>
          <span className={cn("text-[var(--text-primary)]", isEdited && "text-[var(--warning)]")}>
            {displayValue}
          </span>
          {isLarge && (
            <span className="text-[var(--text-muted)] text-xs ml-1" title="Large value">
              [...]
            </span>
          )}
        </>
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
  startRowNumber = 1,
  selectedRowIndex = null,
  onRowSelect,
  onCellEdit,
  editedCells = new Set(),
  deletedRows = new Set(),
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

    // Compare values properly - handle objects/JSON by comparing string representations
    const valuesEqual = (a: CellValue, b: CellValue): boolean => {
      if (a === b) return true;
      if (a === null || b === null) return a === b;

      // Handle objects (JSONB columns)
      if (typeof a === "object" && typeof b === "object") {
        return JSON.stringify(a) === JSON.stringify(b);
      }
      // Handle case where one is string representation of the other (JSONB edit)
      if (typeof a === "object" && typeof b === "string") {
        return JSON.stringify(a) === b;
      }
      if (typeof a === "string" && typeof b === "object") {
        return a === JSON.stringify(b);
      }

      // For primitives, compare as strings to handle type coercion
      return String(a) === String(b);
    };

    // Only trigger edit if value actually changed
    if (!valuesEqual(value, originalValue)) {
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
        <thead className="sticky top-0 z-20">
          <tr className="bg-[var(--bg-secondary)]">
            {/* Row number header - sticky both top and left, highest z-index for corner */}
            <th
              className="text-center border-b border-[var(--border-color)] bg-[var(--bg-secondary)] sticky left-0 z-30 shadow-[inset_-2px_0_0_0_var(--border-color)]"
              style={{ width: 50, minWidth: 50 }}
            >
              <span className="text-[10px] text-[var(--text-muted)]">#</span>
            </th>
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
            const isDeleted = deletedRows.has(rowIndex);

            return (
              <tr
                key={rowIndex}
                onClick={() => onRowSelect?.(rowIndex)}
                className={cn(
                  "transition-colors group",
                  isDeleted
                    ? "bg-red-500/10 hover:bg-red-500/20"
                    : isEven
                      ? "bg-[var(--bg-primary)]"
                      : "bg-[var(--bg-secondary)]/30",
                  isSelected && !isDeleted && "!bg-[var(--accent)]/10",
                  !isDeleted && "hover:bg-[var(--bg-tertiary)]"
                )}
              >
                {/* Row number cell - sticky on left, must have opaque bg */}
                <td
                  className={cn(
                    "text-center border-b border-[var(--border-color)]",
                    "text-xs select-none",
                    "sticky left-0 z-10 shadow-[inset_-2px_0_0_0_var(--border-color)]",
                    "transition-colors",
                    isDeleted
                      ? "bg-red-950 text-red-400"
                      : isSelected
                        ? "bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
                        : isEven
                          ? "bg-[var(--bg-primary)] text-[var(--text-muted)]"
                          : "bg-[var(--bg-secondary)] text-[var(--text-muted)]",
                    !isDeleted && "group-hover:bg-[var(--bg-tertiary)]"
                  )}
                  style={{ width: 50, minWidth: 50 }}
                >
                  <span className={cn(isDeleted && "line-through")}>{startRowNumber + rowIndex}</span>
                </td>
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
                        isEdited && !isDeleted && "bg-[var(--warning)]/10",
                        isDeleted && "line-through text-red-400/70"
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
                        isEditing={isEditing && !isDeleted}
                        onStartEdit={() => !isDeleted && handleStartEdit(rowIndex, column.name)}
                        onSave={(newValue) => handleSaveEdit(rowIndex, column.name, newValue)}
                        onCancel={handleCancelEdit}
                        readOnly={readOnly || isDeleted}
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
