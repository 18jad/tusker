import { useState, useCallback, useRef, useEffect } from "react";
import DatePicker from "react-datepicker";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/uiStore";
import { RelationSelect } from "../ui/RelationSelect";
import { EnumSelect } from "../ui/EnumSelect";
import type { Column, Row, CellValue } from "../../types";
import { Key, Hash, Type, Calendar, ToggleLeft, Braces } from "lucide-react";
import "react-datepicker/dist/react-datepicker.css";

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
  if (type.includes("json")) {
    return <Braces className="w-3 h-3" />;
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
 * Get the input type for a PostgreSQL data type
 */
function getInputType(dataType: string): "text" | "number" | "boolean" | "date" | "time" | "datetime" {
  const type = dataType.toLowerCase();
  if (type === "boolean" || type === "bool") return "boolean";
  if (type.includes("int") || type.includes("serial") || type === "smallint" || type === "bigint") return "number";
  if (type.includes("float") || type.includes("double") || type.includes("numeric") || type.includes("decimal") || type === "real" || type === "money") return "number";
  if (type === "date") return "date";
  if (type === "time" || type === "time without time zone") return "time";
  if (type.includes("timestamp") || type === "timestamptz") return "datetime";
  return "text";
}

/**
 * Parse string to Date
 */
function parseDate(value: string): Date | null {
  if (!value || value === "null" || value === "NULL") return null;
  try {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Parse time string to Date (today with that time)
 */
function parseTime(value: string): Date | null {
  if (!value || value === "null" || value === "NULL") return null;
  try {
    const [hours, minutes, seconds] = value.split(":").map(Number);
    const date = new Date();
    date.setHours(hours || 0, minutes || 0, seconds || 0, 0);
    return date;
  } catch {
    return null;
  }
}

/**
 * Format Date to date-only string (YYYY-MM-DD)
 */
function formatDateOnly(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().split("T")[0];
}

/**
 * Format Date to ISO string for timestamp storage
 */
function formatDatetime(date: Date | null): string {
  if (!date) return "";
  return date.toISOString();
}

/**
 * Format time to HH:mm:ss
 */
function formatTime(date: Date | null): string {
  if (!date) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
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
  const containerRef = useRef<HTMLDivElement>(null);
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

  // Click outside handler to close edit mode
  useEffect(() => {
    if (!isEditing || isLarge) return;

    const handleClickOutside = (e: MouseEvent) => {
      // Check if click is outside the container
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Also check if click is inside a datepicker popup (they render in a portal)
        const isDatepickerPopup = (e.target as Element)?.closest?.(".react-datepicker-popper");
        if (!isDatepickerPopup) {
          onSave(parseValue(editValue, column.dataType));
        }
      }
    };

    // Use mousedown for immediate response
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditing, isLarge, editValue, column.dataType, onSave]);

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
    // Let click-outside handler manage this instead
    // This prevents double-saves and race conditions
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

  // Regular inline editing - render type-appropriate input
  if (isEditing) {
    const inputType = getInputType(column.dataType);
    const inputClasses = cn(
      "flex-1 px-2 py-1 text-sm rounded",
      "bg-[var(--bg-primary)] text-[var(--text-primary)]",
      "border border-[var(--accent)] outline-none",
      "focus:ring-1 focus:ring-[var(--accent)]"
    );

    // Foreign key - use RelationSelect
    if (column.isForeignKey && column.foreignKeyInfo) {
      return (
        <div ref={containerRef} className="px-1 py-1 h-full">
          <RelationSelect
            value={editValue}
            onChange={(val) => {
              setEditValue(val);
              onSave(val === "" ? null : val);
            }}
            foreignKeyInfo={column.foreignKeyInfo}
            className="text-sm [&_button]:py-1 [&_button]:px-2"
          />
        </div>
      );
    }

    // Enum - use styled select dropdown
    if (column.enumValues && column.enumValues.length > 0) {
      return (
        <div ref={containerRef} className="px-1 py-1 h-full">
          <EnumSelect
            value={editValue}
            onChange={(val) => {
              setEditValue(val);
              onSave(val === "" ? null : val);
            }}
            enumValues={column.enumValues}
            isNullable={column.isNullable}
            className="text-sm [&_button]:py-1 [&_button]:px-2"
          />
        </div>
      );
    }

    // Boolean - use select
    if (inputType === "boolean") {
      const boolValue = editValue === "" || editValue === "null" ? "" : editValue === "true" ? "true" : "false";
      return (
        <div ref={containerRef} className="flex items-center gap-1 px-1 py-1 h-full">
          <select
            autoFocus
            value={boolValue}
            onChange={(e) => {
              const val = e.target.value;
              setEditValue(val);
              onSave(val === "" ? null : val === "true");
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
              }
            }}
            className={inputClasses}
          >
            <option value="">NULL</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </div>
      );
    }

    // Date - use DatePicker
    if (inputType === "date") {
      const dateValue = parseDate(editValue);
      return (
        <div ref={containerRef} className="flex items-center gap-1 px-1 py-1 h-full inline-datepicker">
          <DatePicker
            selected={dateValue}
            onChange={(date: Date | null) => {
              const formatted = formatDateOnly(date);
              setEditValue(formatted);
              onSave(formatted || null);
            }}
            autoFocus
            dateFormat="yyyy-MM-dd"
            placeholderText="Select date"
            className={inputClasses}
            calendarClassName="dark-datepicker"
            wrapperClassName="flex-1"
            showPopperArrow={false}
            isClearable
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
              }
            }}
          />
        </div>
      );
    }

    // Time - use DatePicker in time-only mode
    if (inputType === "time") {
      const timeValue = parseTime(editValue);
      return (
        <div ref={containerRef} className="flex items-center gap-1 px-1 py-1 h-full inline-datepicker">
          <DatePicker
            selected={timeValue}
            onChange={(date: Date | null) => {
              const formatted = formatTime(date);
              setEditValue(formatted);
              onSave(formatted || null);
            }}
            autoFocus
            showTimeSelect
            showTimeSelectOnly
            timeIntervals={1}
            timeCaption="Time"
            dateFormat="HH:mm:ss"
            placeholderText="Select time"
            className={inputClasses}
            calendarClassName="dark-datepicker"
            wrapperClassName="flex-1"
            showPopperArrow={false}
            isClearable
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
              }
            }}
          />
        </div>
      );
    }

    // Datetime/Timestamp - use DatePicker with time
    if (inputType === "datetime") {
      const dateValue = parseDate(editValue);
      return (
        <div ref={containerRef} className="flex items-center gap-1 px-1 py-1 h-full inline-datepicker">
          <DatePicker
            selected={dateValue}
            onChange={(date: Date | null) => {
              const formatted = formatDatetime(date);
              setEditValue(formatted);
              onSave(formatted || null);
            }}
            autoFocus
            showTimeSelect
            timeIntervals={1}
            timeCaption="Time"
            dateFormat="yyyy-MM-dd HH:mm:ss"
            placeholderText="Select date & time"
            className={inputClasses}
            calendarClassName="dark-datepicker"
            wrapperClassName="flex-1"
            showPopperArrow={false}
            isClearable
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
              }
            }}
          />
        </div>
      );
    }

    // Number - use text input with numeric inputMode
    if (inputType === "number") {
      const isInteger = column.dataType.toLowerCase().includes("int") || column.dataType.toLowerCase().includes("serial");
      return (
        <div ref={containerRef} className="flex items-center gap-1 px-1 py-1 h-full">
          <input
            ref={inputRef}
            type="text"
            inputMode={isInteger ? "numeric" : "decimal"}
            value={editValue}
            onChange={(e) => {
              const val = e.target.value;
              // Allow empty, minus sign, or valid number patterns
              if (val === "" || val === "-") {
                setEditValue(val);
              } else if (isInteger) {
                if (/^-?\d*$/.test(val)) setEditValue(val);
              } else {
                if (/^-?\d*\.?\d*$/.test(val)) setEditValue(val);
              }
            }}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className={inputClasses}
            placeholder={column.isNullable ? "NULL" : ""}
          />
        </div>
      );
    }

    // Default: text input
    return (
      <div ref={containerRef} className="flex items-center gap-1 px-1 py-1 h-full">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={inputClasses}
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
                <div className="flex flex-col px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    {column.isPrimaryKey ? (
                      <Key className="w-3 h-3 flex-shrink-0 text-[var(--warning)]" />
                    ) : (
                      <span className="flex-shrink-0 text-[var(--text-muted)]">{getTypeIcon(column.dataType)}</span>
                    )}
                    <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                      {column.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] truncate">
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
                {/* Row number cell - sticky on left, handles row selection */}
                <td
                  onClick={() => onRowSelect?.(rowIndex)}
                  className={cn(
                    "text-center border-b border-[var(--border-color)]",
                    "text-xs select-none cursor-pointer",
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
          Click row number to select • Double-click cell to edit • Enter to save • Escape to cancel
        </div>
      )}
    </div>
  );
}
