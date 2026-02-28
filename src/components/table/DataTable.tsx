import React, { useState, useCallback, useRef, useEffect } from "react";
import DatePicker from "react-datepicker";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/uiStore";
import { RelationSelect } from "../ui/RelationSelect";
import { EnumSelect } from "../ui/EnumSelect";
import { ContextMenu } from "../ui/ContextMenu";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../ui/Select";
import type { Column, Row, CellValue, SortColumn } from "../../types";
import { Key, Hash, Type, Calendar, ToggleLeft, Braces, ArrowUp, ArrowDown, Copy, Columns, RotateCcw, ChevronDown, Pencil, Ban, ClipboardCopy, MousePointerClick, Database, ExternalLink } from "lucide-react";
import { ForeignKeySubRow, openRelatedTable } from "./ForeignKeyPreview";
import "react-datepicker/dist/react-datepicker.css";

interface DataTableProps {
  tableKey: string;
  columns: Column[];
  rows: Row[];
  startRowNumber?: number;
  selectedRowIndices?: Set<number>;
  onRowSelect?: (index: number, modifiers: { shift: boolean; ctrl: boolean }) => void;
  onCellEdit?: (rowIndex: number, columnName: string, value: CellValue) => void;
  editedCells?: Set<string>;
  deletedRows?: Set<number>;
  readOnly?: boolean;
  sorts?: SortColumn[];
  onSort?: (columnName: string, addToSort: boolean) => void;
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
function getInputType(dataType: string): "text" | "number" | "boolean" | "date" | "time" | "datetime" | "array" {
  const type = dataType.toLowerCase();
  if (type === "boolean" || type === "bool") return "boolean";
  if (type.includes("int") || type.includes("serial") || type === "smallint" || type === "bigint") return "number";
  if (type.includes("float") || type.includes("double") || type.includes("numeric") || type.includes("decimal") || type === "real" || type === "money") return "number";
  if (type === "date") return "date";
  if (type === "time" || type === "time without time zone") return "time";
  if (type.includes("timestamp") || type === "timestamptz") return "datetime";
  // PostgreSQL returns "ARRAY" as data_type, or types ending with [] or starting with _
  if (type === "array" || type.endsWith("[]") || type.startsWith("_")) return "array";
  return "text";
}

/**
 * Parse PostgreSQL array literal to JavaScript array
 */
function parseArrayValue(value: CellValue): string[] {
  if (value === null || value === undefined) return [];

  // Already an array (from JSON response)
  if (Array.isArray(value)) {
    return value.map(v => String(v ?? ""));
  }

  const str = String(value).trim();
  if (!str || str === "NULL" || str === "null") return [];

  // PostgreSQL array format: {item1,item2,"item with spaces"}
  if (str.startsWith("{") && str.endsWith("}")) {
    const inner = str.slice(1, -1);
    if (!inner) return [];

    const items: string[] = [];
    let current = "";
    let inQuotes = false;
    let escaped = false;

    for (let i = 0; i < inner.length; i++) {
      const char = inner[i];

      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (char === "," && !inQuotes) {
        items.push(current);
        current = "";
        continue;
      }

      current += char;
    }

    if (current || inner.endsWith(",")) {
      items.push(current);
    }

    return items.map(item => item === "NULL" ? "" : item);
  }

  // JSON array format: ["item1", "item2"]
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed)) {
      return parsed.map(v => String(v ?? ""));
    }
  } catch {
    // Not JSON
  }

  // Single value
  return [str];
}

/**
 * Format JavaScript array to PostgreSQL array literal
 */
function formatArrayValue(items: string[]): string {
  if (items.length === 0) return "{}";

  const formatted = items.map(item => {
    // Check if item needs quoting (contains comma, quote, backslash, or whitespace)
    if (/[,"\\\s]/.test(item) || item === "") {
      // Escape backslashes and quotes
      const escaped = item.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `"${escaped}"`;
    }
    return item;
  });

  return `{${formatted.join(",")}}`;
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
 * Array editor component - modal for editing array values
 */
function ArrayEditor({
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<string[]>(() => parseArrayValue(value));
  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleAddItem = () => {
    const trimmed = newItem.trim();
    if (trimmed) {
      setItems([...items, trimmed]);
      setNewItem("");
      inputRef.current?.focus();
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (newItem.trim()) {
        handleAddItem();
      } else if (e.metaKey || e.ctrlKey) {
        onSave(formatArrayValue(items));
      }
    }
  };

  const handleSave = () => {
    onSave(formatArrayValue(items));
  };

  // Get base type for display
  const baseType = column.dataType.replace("[]", "").replace(/^_/, "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className={cn(
          "w-[500px] max-w-[90vw] max-h-[80vh] flex flex-col",
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
          <span className="text-xs text-[var(--text-muted)]">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        </div>

        {/* Items list */}
        <div className="flex-1 p-4 min-h-0 overflow-y-auto">
          {items.length === 0 ? (
            <div className="text-sm text-[var(--text-muted)] text-center py-4">
              No items. Add some below.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {items.map((item, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-md",
                    "bg-[var(--bg-tertiary)] text-[var(--text-primary)]",
                    "border border-[var(--border-color)]",
                    "text-sm group"
                  )}
                >
                  <span className="max-w-[200px] truncate" title={item}>
                    {item || <span className="text-[var(--text-muted)] italic">empty</span>}
                  </span>
                  <button
                    onClick={() => handleRemoveItem(index)}
                    className={cn(
                      "p-0.5 rounded",
                      "text-[var(--text-muted)] hover:text-red-400",
                      "hover:bg-red-500/10 transition-colors"
                    )}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add item input */}
        <div className="px-4 py-3 border-t border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Add ${baseType} value...`}
              className={cn(
                "flex-1 h-9 px-3 text-sm rounded-md",
                "bg-[var(--bg-secondary)] text-[var(--text-primary)]",
                "border border-[var(--border-color)]",
                "focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]",
                "placeholder:text-[var(--text-muted)]"
              )}
            />
            <button
              onClick={handleAddItem}
              disabled={!newItem.trim()}
              className={cn(
                "h-9 px-3 rounded-md text-sm font-medium",
                "bg-[var(--accent)] text-white",
                "hover:opacity-90 transition-opacity",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              Add
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-color)]">
          <span className="text-xs text-[var(--text-muted)]">
            Enter to add • Cmd/Ctrl+Enter to save • Escape to cancel
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
              className={cn(
                "px-3 py-1.5 text-sm rounded-md",
                "bg-[var(--accent)] text-white",
                "hover:opacity-90 transition-opacity"
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
  isFkPreviewOpen = false,
  onFkPreview,
}: {
  value: CellValue;
  column: Column;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (value: CellValue) => void;
  onCancel: () => void;
  readOnly: boolean;
  isEdited?: boolean;
  isFkPreviewOpen?: boolean;
  onFkPreview?: () => void;
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

    // Array - use ArrayEditor modal
    if (inputType === "array") {
      return (
        <>
          <div className={cn("px-3 py-2 truncate text-sm h-full flex items-center gap-1")}>
            {isEdited && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)] shrink-0" title="Modified" />
            )}
            <span className="text-[var(--text-muted)] italic text-xs">Editing array...</span>
          </div>
          <ArrayEditor
            value={value}
            column={column}
            onSave={onSave}
            onCancel={onCancel}
          />
        </>
      );
    }

    // Boolean - use select
    if (inputType === "boolean") {
      const boolValue = editValue === "" || editValue === "null" ? "__null__" : editValue === "true" ? "true" : "false";
      return (
        <div ref={containerRef} className="flex items-center gap-1 px-1 py-1 h-full">
          <Select
            value={boolValue}
            onValueChange={(val) => {
              const mapped = val === "__null__" ? "" : val;
              setEditValue(mapped);
              onSave(mapped === "" ? null : mapped === "true");
            }}
          >
            <SelectTrigger className={inputClasses}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__null__">NULL</SelectItem>
              <SelectItem value="true">true</SelectItem>
              <SelectItem value="false">false</SelectItem>
            </SelectContent>
          </Select>
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

  const hasFkPreview = column.isForeignKey && column.foreignKeyInfo && !isNull && onFkPreview;

  return (
    <div
      className={cn(
        "px-3 py-2 truncate text-sm h-full flex items-center gap-1 group/fk",
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
          <span className={cn("text-[var(--text-primary)] truncate", isEdited && "text-[var(--warning)]")}>
            {displayValue}
          </span>
          {isLarge && (
            <span className="text-[var(--text-muted)] text-xs ml-1" title="Large value">
              [...]
            </span>
          )}
        </>
      )}
      {hasFkPreview && (
        <button
          className={cn(
            "ml-auto p-0.5 rounded transition-colors shrink-0",
            "opacity-0 group-hover/fk:opacity-100",
            "hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--accent)]",
            isFkPreviewOpen && "!opacity-100 bg-[var(--bg-tertiary)] text-[var(--accent)]"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onFkPreview();
          }}
          onDoubleClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          title={`Preview ${column.foreignKeyInfo!.referencedTable}`}
        >
          <ExternalLink className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

/**
 * Build context menu items for a data cell
 */
function buildCellContextMenu({
  value,
  row,
  column,
  readOnly,
  isDeleted,
  onStartEdit,
  onCellEdit,
  rowIndex,
  tableKey,
  hasSort,
}: {
  value: CellValue;
  row: Row;
  column: Column;
  readOnly: boolean;
  isDeleted: boolean;
  onStartEdit: () => void;
  onCellEdit?: (rowIndex: number, columnName: string, value: CellValue) => void;
  rowIndex: number;
  tableKey: string;
  hasSort: boolean;
}) {
  const rawValue = value === null ? "NULL" : typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);

  const items: Parameters<typeof ContextMenu>[0]["items"] = [
    {
      label: "Copy Value",
      icon: <ClipboardCopy className="w-3.5 h-3.5" />,
      onClick: () => {
        navigator.clipboard.writeText(rawValue);
        useUIStore.getState().showToast("Value copied to clipboard", "info");
      },
    },
    {
      label: "Copy Row as JSON",
      icon: <Braces className="w-3.5 h-3.5" />,
      onClick: () => {
        navigator.clipboard.writeText(JSON.stringify(row, null, 2));
        useUIStore.getState().showToast("Row copied as JSON", "info");
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
  ];

  if (!readOnly && !isDeleted) {
    items.push({ type: "separator" });
    items.push({
      label: "Edit Cell",
      icon: <Pencil className="w-3.5 h-3.5" />,
      onClick: onStartEdit,
    });
    if (column.isNullable && value !== null) {
      items.push({
        label: "Set to NULL",
        icon: <Ban className="w-3.5 h-3.5" />,
        onClick: () => onCellEdit?.(rowIndex, column.name, null),
      });
    }
  }

  if (column.isForeignKey && column.foreignKeyInfo && value !== null) {
    items.push({ type: "separator" });
    items.push({
      label: "Open Related Table",
      icon: <ExternalLink className="w-3.5 h-3.5" />,
      onClick: () => openRelatedTable(column.foreignKeyInfo!, value as string | number),
    });
  }

  if (hasSort) {
    items.push({ type: "separator" });
    items.push({
      label: "Sort Ascending",
      icon: <ArrowUp className="w-3.5 h-3.5" />,
      onClick: () => useUIStore.getState().setTableSort(tableKey, [{ column: column.name, direction: "ASC" }]),
    });
    items.push({
      label: "Sort Descending",
      icon: <ArrowDown className="w-3.5 h-3.5" />,
      onClick: () => useUIStore.getState().setTableSort(tableKey, [{ column: column.name, direction: "DESC" }]),
    });
  }

  return items;
}

/**
 * Format a cell value as a SQL literal
 */
function formatSqlValue(value: CellValue): string {
  if (value === null) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  if (typeof value === "object") return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Build context menu items for a row number cell
 */
function buildRowContextMenu({
  row,
  columns,
  tableKey,
  rowIndex,
  isSelected,
  onRowSelect,
}: {
  row: Row;
  columns: Column[];
  tableKey: string;
  rowIndex: number;
  isSelected: boolean;
  onRowSelect?: (index: number, modifiers: { shift: boolean; ctrl: boolean }) => void;
}) {
  const [schema, table] = tableKey.split(".");

  const insertCols = columns.map((c) => `"${c.name}"`).join(", ");
  const insertVals = columns.map((c) => formatSqlValue(row[c.name])).join(", ");
  const insertSql = `INSERT INTO "${schema}"."${table}" (${insertCols}) VALUES (${insertVals});`;

  const items: Parameters<typeof ContextMenu>[0]["items"] = [
    {
      label: "Copy Row as JSON",
      icon: <Braces className="w-3.5 h-3.5" />,
      onClick: () => {
        navigator.clipboard.writeText(JSON.stringify(row, null, 2));
        useUIStore.getState().showToast("Row copied as JSON", "info");
      },
    },
    {
      label: "Copy as INSERT",
      icon: <Database className="w-3.5 h-3.5" />,
      onClick: () => {
        navigator.clipboard.writeText(insertSql);
        useUIStore.getState().showToast("INSERT statement copied", "info");
      },
    },
  ];

  if (onRowSelect) {
    items.push({ type: "separator" });
    items.push({
      label: isSelected ? "Deselect Row" : "Select Row",
      icon: <MousePointerClick className="w-3.5 h-3.5" />,
      onClick: () => onRowSelect(rowIndex, { shift: false, ctrl: true }),
    });
  }

  return items;
}

/**
 * Clean, modern data table with inline editing
 */
export function DataTable({
  tableKey,
  columns,
  rows,
  startRowNumber = 1,
  selectedRowIndices = new Set(),
  onRowSelect,
  onCellEdit,
  editedCells = new Set(),
  deletedRows = new Set(),
  readOnly = false,
  sorts = [],
  onSort,
}: DataTableProps) {
  const allColumnWidths = useUIStore((state) => state.columnWidths);
  const setColumnWidth = useUIStore((state) => state.setColumnWidth);
  const setTableSort = useUIStore((state) => state.setTableSort);
  const [resizing, setResizing] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [hoveringRowNumber, setHoveringRowNumber] = useState<number | null>(null);
  const [fkPreview, setFkPreview] = useState<{ row: number; col: string } | null>(null);

  const handleToggleFkPreview = useCallback((rowIndex: number, colName: string) => {
    setFkPreview((prev) =>
      prev?.row === rowIndex && prev?.col === colName ? null : { row: rowIndex, col: colName }
    );
  }, []);

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

  // Context menu handlers for column headers
  const handleSortAscending = useCallback((columnName: string) => {
    // Set sort to ASC for this column (replace any existing sorts with single column ASC)
    setTableSort(tableKey, [{ column: columnName, direction: "ASC" }]);
  }, [tableKey, setTableSort]);

  const handleSortDescending = useCallback((columnName: string) => {
    // Set sort to DESC for this column (replace any existing sorts with single column DESC)
    setTableSort(tableKey, [{ column: columnName, direction: "DESC" }]);
  }, [tableKey, setTableSort]);

  const handleResetSort = useCallback(() => {
    // Clear all sorts
    setTableSort(tableKey, []);
  }, [tableKey, setTableSort]);

  const handleCopyColumnName = useCallback((columnName: string) => {
    navigator.clipboard.writeText(columnName);
  }, []);

  const handleResetLayout = useCallback(() => {
    useUIStore.getState().resetColumnWidths(tableKey);
  }, [tableKey]);

  if (columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
        No columns to display
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto min-h-0" style={{ containerType: "inline-size" }}>
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
            {columns.map((column) => {
              const sortIndex = sorts.findIndex((s) => s.column === column.name);
              const isSorted = sortIndex !== -1;
              const sortEntry = isSorted ? sorts[sortIndex] : null;
              const isAsc = sortEntry?.direction === "ASC";
              const isMultiSort = sorts.length > 1;
              const isFkPinned = fkPreview?.col === column.name;

              return (
                <th
                  key={column.name}
                  className={cn(
                    "relative text-left border-b border-r border-[var(--border-color)] last:border-r-0",
                    isFkPinned && "sticky z-20 bg-[var(--bg-secondary)] shadow-[inset_-2px_0_0_0_var(--border-color)]"
                  )}
                  style={{
                    width: getColumnWidth(column.name),
                    minWidth: getColumnWidth(column.name),
                    ...(isFkPinned ? { left: 50 } : {}),
                  }}
                  aria-sort={isSorted ? (isAsc ? "ascending" : "descending") : "none"}
                >
                  <ContextMenu
                    items={[
                      {
                        label: "Sort Ascending",
                        icon: <ArrowUp className="w-3.5 h-3.5" />,
                        onClick: () => handleSortAscending(column.name),
                        disabled: !onSort,
                      },
                      {
                        label: "Sort Descending",
                        icon: <ArrowDown className="w-3.5 h-3.5" />,
                        onClick: () => handleSortDescending(column.name),
                        disabled: !onSort,
                      },
                      {
                        label: "Reset Sort",
                        icon: <RotateCcw className="w-3.5 h-3.5" />,
                        onClick: handleResetSort,
                        disabled: !onSort || sorts.length === 0,
                      },
                      { type: "separator" },
                      {
                        label: "Copy Column Name",
                        icon: <Copy className="w-3.5 h-3.5" />,
                        onClick: () => handleCopyColumnName(column.name),
                      },
                      { type: "separator" },
                      {
                        label: "Reset Layout",
                        icon: <Columns className="w-3.5 h-3.5" />,
                        onClick: handleResetLayout,
                      },
                    ]}
                  >
                    <div
                      className={cn(
                        "flex flex-col px-3 py-1.5 transition-colors relative group",
                        onSort && "cursor-pointer select-none hover:bg-[var(--bg-tertiary)]/50",
                        isSorted && "bg-[var(--bg-tertiary)]/30"
                      )}
                      onClick={(e) => {
                        // Don't trigger sort if clicking on chevron
                        if ((e.target as HTMLElement).closest('.context-menu-trigger')) {
                          return;
                        }
                        onSort?.(column.name, e.shiftKey);
                      }}
                      onKeyDown={(e) => {
                        if (onSort && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          onSort(column.name, e.shiftKey);
                        }
                      }}
                      tabIndex={onSort ? 0 : undefined}
                      role={onSort ? "button" : undefined}
                      aria-label={onSort ? `Sort by ${column.name}${isSorted ? (isAsc ? ", currently ascending" : ", currently descending") : ""}. Hold Shift to add to multi-sort.` : undefined}
                    >
                      <div className="flex items-center gap-2">
                        {column.isPrimaryKey ? (
                          <Key className="w-3 h-3 flex-shrink-0 text-[var(--warning)]" />
                        ) : (
                          <span className="flex-shrink-0 text-[var(--text-muted)]">{getTypeIcon(column.dataType)}</span>
                        )}
                        <span className={cn(
                          "text-xs font-medium truncate",
                          isSorted ? "text-[var(--accent)]" : "text-[var(--text-primary)]"
                        )}>
                          {column.name}
                        </span>
                        <div className="flex items-center gap-0.5 ml-auto">
                          {isSorted && (
                            <span className="flex items-center gap-0.5 flex-shrink-0">
                              {isMultiSort && (
                                <span className="text-[9px] font-semibold text-[var(--accent)] min-w-[12px] h-[14px] flex items-center justify-center rounded bg-[var(--accent)]/15">
                                  {sortIndex + 1}
                                </span>
                              )}
                              {isAsc
                                ? <ArrowUp className="w-3 h-3 text-[var(--accent)]" />
                                : <ArrowDown className="w-3 h-3 text-[var(--accent)]" />
                              }
                            </span>
                          )}
                          <button
                            className="context-menu-trigger opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-[var(--bg-tertiary)] rounded"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Trigger a synthetic context menu event
                              const syntheticEvent = new MouseEvent('contextmenu', {
                                bubbles: true,
                                cancelable: true,
                                view: window,
                                clientX: e.clientX,
                                clientY: e.clientY,
                              });
                              e.currentTarget.parentElement?.parentElement?.dispatchEvent(syntheticEvent);
                            }}
                            aria-label="Open column menu"
                          >
                            <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
                          </button>
                        </div>
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] truncate">
                        {column.dataType}
                      </span>
                    </div>
                  </ContextMenu>
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
              );
            })}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {rows.map((row, rowIndex) => {
            const isSelected = selectedRowIndices.has(rowIndex);
            const isEven = rowIndex % 2 === 0;
            const isDeleted = deletedRows.has(rowIndex);
            const isRowHovered = hoveringRowNumber === rowIndex;
            const fkCol = fkPreview?.row === rowIndex ? columns.find((c) => c.name === fkPreview.col) : null;

            return (
              <React.Fragment key={rowIndex}>
              <tr
                className={cn(
                  "transition-colors",
                  isDeleted
                    ? "bg-red-500/10"
                    : isEven
                      ? "bg-[var(--bg-primary)]"
                      : "bg-[var(--bg-secondary)]/30",
                  isSelected && !isDeleted && "!bg-[var(--accent)]/10",
                  isRowHovered && !isDeleted && !isSelected && "!bg-[var(--bg-tertiary)]"
                )}
              >
                {/* Row number cell - sticky on left, handles row selection */}
                <td
                  onClick={(e) => onRowSelect?.(rowIndex, { shift: e.shiftKey, ctrl: e.metaKey || e.ctrlKey })}
                  onMouseEnter={() => setHoveringRowNumber(rowIndex)}
                  onMouseLeave={() => setHoveringRowNumber(null)}
                  className={cn(
                    "text-center border-b border-[var(--border-color)]",
                    "text-xs select-none cursor-pointer",
                    "sticky left-0 z-10 shadow-[inset_-2px_0_0_0_var(--border-color)]",
                    "transition-colors",
                    isDeleted
                      ? "bg-red-950 text-red-400 hover:bg-red-900"
                      : isSelected
                        ? "bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]"
                        : isEven
                          ? "bg-[var(--bg-primary)] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]"
                          : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]"
                  )}
                  style={{ width: 50, minWidth: 50 }}
                >
                  <ContextMenu
                    className="w-full h-full flex items-center justify-center py-2"
                    items={buildRowContextMenu({
                      row,
                      columns,
                      tableKey,
                      rowIndex,
                      isSelected,
                      onRowSelect,
                    })}
                  >
                    <span className={cn(isDeleted && "line-through")}>{startRowNumber + rowIndex}</span>
                  </ContextMenu>
                </td>
                {columns.map((column) => {
                  const value = row[column.name];
                  const isEditing = editingCell?.row === rowIndex && editingCell?.col === column.name;
                  const cellKey = `${rowIndex}:${column.name}`;
                  const isEdited = editedCells.has(cellKey);
                  const isFkPreviewOpen = fkPreview?.row === rowIndex && fkPreview?.col === column.name;
                  const isFkPinned = fkPreview?.col === column.name;

                  // Determine background for pinned FK column cells
                  const pinnedBg = isFkPinned
                    ? isDeleted
                      ? "bg-red-950"
                      : isSelected
                        ? "bg-[var(--bg-tertiary)]"
                        : isEven
                          ? "bg-[var(--bg-primary)]"
                          : "bg-[var(--bg-secondary)]"
                    : undefined;

                  return (
                    <td
                      key={column.name}
                      className={cn(
                        "border-b border-r border-[var(--border-color)] last:border-r-0",
                        "transition-colors",
                        isEditing && "p-0",
                        isEdited && !isDeleted && "bg-[var(--warning)]/10",
                        isDeleted && "line-through text-red-400/70",
                        // Cell hover - only when not editing, not deleted, not row-number-hovered
                        !isEditing && !isDeleted && !isRowHovered && "hover:bg-[var(--bg-tertiary)]",
                        isFkPinned && "sticky z-10 shadow-[inset_-2px_0_0_0_var(--border-color)]",
                        pinnedBg,
                      )}
                      style={{
                        width: getColumnWidth(column.name),
                        minWidth: getColumnWidth(column.name),
                        maxWidth: getColumnWidth(column.name),
                        ...(isFkPinned ? { left: 50 } : {}),
                      }}
                    >
                      <ContextMenu
                        disabled={isEditing}
                        items={buildCellContextMenu({
                          value,
                          row,
                          column,
                          readOnly,
                          isDeleted,
                          onStartEdit: () => !isDeleted && handleStartEdit(rowIndex, column.name),
                          onCellEdit,
                          rowIndex,
                          tableKey,
                          hasSort: !!onSort,
                        })}
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
                          isFkPreviewOpen={isFkPreviewOpen}
                          onFkPreview={
                            column.isForeignKey && column.foreignKeyInfo
                              ? () => handleToggleFkPreview(rowIndex, column.name)
                              : undefined
                          }
                        />
                      </ContextMenu>
                    </td>
                  );
                })}
              </tr>
              {fkCol?.foreignKeyInfo && (
                <ForeignKeySubRow
                  value={row[fkCol.name]}
                  foreignKeyInfo={fkCol.foreignKeyInfo}
                  colSpan={columns.length + 1}
                  onClose={() => setFkPreview(null)}
                />
              )}
              </React.Fragment>
            );
          })}
        </tbody>
        </table>
      </div>

      {/* Edit hint - outside scroll container */}
      {!readOnly && (
        <div className="shrink-0 px-3 py-1.5 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] text-[10px] text-[var(--text-muted)]">
          Click row number to select • Shift+click for range • Cmd/Ctrl+click to toggle • Double-click cell to edit • Right-click for more
        </div>
      )}
    </div>
  );
}
