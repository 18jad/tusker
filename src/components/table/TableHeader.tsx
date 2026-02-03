import { useCallback, useRef, useState, type MouseEvent } from "react";
import { cn } from "../../lib/utils";
import type { Column } from "../../types";
import { Key, Hash, Type, Calendar, ToggleLeft, Braces } from "lucide-react";

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

interface TableHeaderProps {
  column: Column;
  width: number;
  onResize: (delta: number) => void;
  sortDirection?: "asc" | "desc" | null;
  onSort?: () => void;
}

/**
 * Maps PostgreSQL data types to display badges
 */
function getTypeBadge(dataType: string): { label: string; color: string } {
  const type = dataType.toLowerCase();

  // Integer types
  if (
    type.includes("int") ||
    type.includes("serial") ||
    type === "smallserial" ||
    type === "bigserial"
  ) {
    return { label: "int", color: "bg-blue-500/20 text-blue-400" };
  }

  // Floating point types
  if (
    type.includes("float") ||
    type.includes("double") ||
    type.includes("real") ||
    type.includes("numeric") ||
    type.includes("decimal")
  ) {
    return { label: "num", color: "bg-purple-500/20 text-purple-400" };
  }

  // Boolean
  if (type.includes("bool")) {
    return { label: "bool", color: "bg-amber-500/20 text-amber-400" };
  }

  // Text types
  if (
    type.includes("text") ||
    type.includes("char") ||
    type.includes("varchar")
  ) {
    return { label: "text", color: "bg-green-500/20 text-green-400" };
  }

  // Date/Time types
  if (
    type.includes("date") ||
    type.includes("time") ||
    type.includes("timestamp")
  ) {
    return { label: "date", color: "bg-cyan-500/20 text-cyan-400" };
  }

  // JSON types
  if (type.includes("json")) {
    return { label: "json", color: "bg-orange-500/20 text-orange-400" };
  }

  // UUID
  if (type.includes("uuid")) {
    return { label: "uuid", color: "bg-pink-500/20 text-pink-400" };
  }

  // Array types
  if (type.includes("[]") || type.includes("array")) {
    return { label: "arr", color: "bg-indigo-500/20 text-indigo-400" };
  }

  // Default
  return { label: type.slice(0, 4), color: "bg-gray-500/20 text-gray-400" };
}

/**
 * Column header component with resize handle and sort indicator
 */
export function TableHeader({
  column,
  width,
  onResize,
  sortDirection,
  onSort,
}: TableHeaderProps) {
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const typeBadge = getTypeBadge(column.dataType);

  const handleResizeStart = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      startXRef.current = e.clientX;
      startWidthRef.current = width;

      const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
        const delta = moveEvent.clientX - startXRef.current;
        onResize(delta);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [width, onResize]
  );

  return (
    <div
      className={cn(
        "relative flex items-start gap-2 px-3 py-1.5",
        "bg-[--bg-secondary] border-r border-b border-[--border-color]",
        "select-none",
        onSort && "cursor-pointer hover:bg-[--bg-tertiary]"
      )}
      style={{ width, minWidth: width, maxWidth: width }}
      onClick={onSort}
    >
      {/* Icon */}
      {column.isPrimaryKey ? (
        <Key className="w-3 h-3 flex-shrink-0 mt-0.5 text-amber-500" />
      ) : (
        <span className="flex-shrink-0 mt-0.5 text-[--text-muted]">{getTypeIcon(column.dataType)}</span>
      )}

      {/* Column info */}
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-[--text-primary] truncate flex-1">
            {column.name}
          </span>
          {sortDirection && (
            <span className="flex-shrink-0 text-[--text-muted]">
              {sortDirection === "asc" ? (
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 15l7-7 7 7"
                  />
                </svg>
              ) : (
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              )}
            </span>
          )}
        </div>
        <span className={cn("text-[10px] truncate", typeBadge.color)}>
          {column.dataType}
        </span>
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className={cn(
          "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize",
          "hover:bg-[--accent] transition-colors",
          isResizing && "bg-[--accent]"
        )}
      />
    </div>
  );
}
