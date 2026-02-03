import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
} from "react";
import { cn } from "../../lib/utils";
import type { CellValue, Column } from "../../types";

interface TableCellProps {
  value: CellValue;
  column: Column;
  isEdited: boolean;
  isSelected: boolean;
  onEdit: (value: CellValue) => void;
  onClick: () => void;
  readOnly?: boolean;
}

/**
 * Determines if a value is JSON (object or array)
 */
function isJsonValue(value: CellValue): value is object {
  return value !== null && typeof value === "object";
}

/**
 * Formats a cell value for display
 */
function formatDisplayValue(value: CellValue): string {
  if (value === null) return "NULL";
  if (value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (isJsonValue(value)) {
    const str = JSON.stringify(value);
    return str.length > 50 ? str.slice(0, 47) + "..." : str;
  }
  return String(value);
}

/**
 * Parses input string to appropriate CellValue based on column type
 */
function parseInputValue(input: string, column: Column): CellValue {
  const trimmed = input.trim();

  // Handle NULL
  if (trimmed.toUpperCase() === "NULL" || trimmed === "") {
    return null;
  }

  const dataType = column.dataType.toLowerCase();

  // Boolean types
  if (dataType.includes("bool")) {
    return trimmed.toLowerCase() === "true" || trimmed === "1";
  }

  // Numeric types
  if (
    dataType.includes("int") ||
    dataType.includes("serial") ||
    dataType.includes("numeric") ||
    dataType.includes("decimal") ||
    dataType.includes("float") ||
    dataType.includes("double") ||
    dataType.includes("real")
  ) {
    const num = Number(trimmed);
    return isNaN(num) ? trimmed : num;
  }

  // JSON types
  if (dataType.includes("json")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

/**
 * Null badge component for displaying NULL values
 */
function NullBadge() {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-[#2a2a2a] text-[--text-muted] italic">
      NULL
    </span>
  );
}

/**
 * Boolean display component with checkbox styling
 */
function BooleanDisplay({ value }: { value: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-4 h-4 rounded border",
        value
          ? "bg-[--accent] border-[--accent]"
          : "bg-transparent border-[#3a3a3a]"
      )}
    >
      {value && (
        <svg
          className="w-3 h-3 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      )}
    </span>
  );
}

/**
 * JSON preview component with expand/collapse functionality
 */
function JsonPreview({
  value,
  isExpanded,
  onToggle,
}: {
  value: object;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const jsonString = JSON.stringify(value, null, 2);
  const preview = JSON.stringify(value);
  const isLong = preview.length > 30;

  return (
    <div className="flex items-start gap-1 min-w-0">
      {isLong && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-[--text-muted] hover:text-[--text-secondary] transition-colors"
        >
          <svg
            className={cn(
              "w-3 h-3 transition-transform",
              isExpanded && "rotate-90"
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      )}
      <span
        className={cn(
          "font-mono text-xs text-[--text-secondary]",
          isExpanded ? "whitespace-pre" : "truncate"
        )}
      >
        {isExpanded ? jsonString : preview.slice(0, 30) + (isLong ? "..." : "")}
      </span>
    </div>
  );
}

/**
 * Editable table cell component with type-aware rendering
 */
export function TableCell({
  value,
  column,
  isEdited,
  isSelected,
  onEdit,
  onClick,
  readOnly = false,
}: TableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [jsonExpanded, setJsonExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cellRef = useRef<HTMLDivElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = useCallback(() => {
    if (readOnly) return;

    // Format value for editing
    let initialValue: string;
    if (value === null) {
      initialValue = "";
    } else if (isJsonValue(value)) {
      initialValue = JSON.stringify(value);
    } else {
      initialValue = String(value);
    }

    setEditValue(initialValue);
    setIsEditing(true);
  }, [value, readOnly]);

  const handleConfirm = useCallback(() => {
    const parsed = parseInputValue(editValue, column);
    onEdit(parsed);
    setIsEditing(false);
  }, [editValue, column, onEdit]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditValue("");
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleConfirm, handleCancel]
  );

  const handleCellClick = useCallback(() => {
    onClick();
  }, [onClick]);

  const handleDoubleClick = useCallback(() => {
    handleStartEdit();
  }, [handleStartEdit]);

  // Render cell content based on value type
  const renderContent = () => {
    if (isEditing) {
      return (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleConfirm}
          className="w-full h-full px-2 bg-[--bg-tertiary] text-[--text-primary] border border-[--accent] rounded-sm outline-none text-sm"
          onClick={(e) => e.stopPropagation()}
        />
      );
    }

    // NULL value
    if (value === null) {
      return <NullBadge />;
    }

    // Boolean value
    if (typeof value === "boolean") {
      return (
        <div className="flex items-center gap-2">
          <BooleanDisplay value={value} />
          <span className="text-[--text-secondary] text-sm">
            {value ? "true" : "false"}
          </span>
        </div>
      );
    }

    // JSON value
    if (isJsonValue(value)) {
      return (
        <JsonPreview
          value={value}
          isExpanded={jsonExpanded}
          onToggle={() => setJsonExpanded(!jsonExpanded)}
        />
      );
    }

    // Default text display
    return (
      <span className="text-sm truncate">{formatDisplayValue(value)}</span>
    );
  };

  return (
    <div
      ref={cellRef}
      onClick={handleCellClick}
      onDoubleClick={handleDoubleClick}
      className={cn(
        "h-full px-3 py-2 flex items-center min-w-0 transition-colors cursor-default",
        "border-r border-[--border-color]",
        isSelected && "bg-[--accent]/10",
        isEdited && "border-l-2 border-l-amber-500",
        !isEditing && !readOnly && "hover:bg-[--bg-tertiary]"
      )}
    >
      {renderContent()}
    </div>
  );
}
