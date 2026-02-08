import { useState } from "react";
import { X, ChevronDown, ChevronRight, Code, Check } from "lucide-react";
import { cn } from "../../lib/utils";
import type { Row } from "../../types";

interface ChangeCardProps {
  type: "insert" | "update" | "delete";
  schema: string;
  table: string;
  data: Row;
  originalData?: Row;
  sql: string;
  onRemove?: () => void;
  /** Allow collapsing the card body */
  collapsible?: boolean;
}

const TYPE_CONFIG = {
  insert: {
    badge: "bg-green-500/20 text-green-400",
    border: "border-green-500/20",
    borderCollapsed: "border-green-500/10",
    bg: "bg-green-500/5",
    bgCollapsed: "bg-green-500/3",
    label: "INSERT",
  },
  update: {
    badge: "bg-amber-500/20 text-amber-400",
    border: "border-amber-500/20",
    borderCollapsed: "border-amber-500/10",
    bg: "bg-amber-500/5",
    bgCollapsed: "bg-amber-500/3",
    label: "UPDATE",
  },
  delete: {
    badge: "bg-red-500/20 text-red-400",
    border: "border-red-500/20",
    borderCollapsed: "border-red-500/10",
    bg: "bg-red-500/5",
    bgCollapsed: "bg-red-500/3",
    label: "DELETE",
  },
};

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getChangeSummary(type: "insert" | "update" | "delete", data: Row, originalData?: Row): string {
  if (type === "update" && originalData) {
    const changed = Object.keys(data).filter((k) => formatCellValue(data[k]) !== formatCellValue(originalData[k]));
    return `${changed.length} field${changed.length !== 1 ? "s" : ""} changed`;
  }
  const fields = Object.entries(data).filter(([, v]) => v !== null && v !== undefined);
  return `${fields.length} field${fields.length !== 1 ? "s" : ""}`;
}

export function ChangeCard({ type, schema, table, data, originalData, sql, onRemove, collapsible }: ChangeCardProps) {
  const [showSql, setShowSql] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const config = TYPE_CONFIG[type];

  if (collapsed && collapsible) {
    return (
      <div className={cn(
        "rounded-lg border px-4 py-2.5 flex items-center gap-2",
        config.bgCollapsed, config.borderCollapsed
      )}>
        <button
          onClick={() => setCollapsed(false)}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0"
          title="Expand"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <span className={cn("px-2 py-0.5 rounded text-xs font-mono font-medium shrink-0", config.badge)}>
          {config.label}
        </span>
        <span className="text-xs text-[var(--text-secondary)] font-mono truncate">
          {schema}.{table}
        </span>
        <span className="text-[10px] text-[var(--text-muted)]">
          {getChangeSummary(type, data, originalData)}
        </span>
        <Check className="w-3 h-3 text-green-400 ml-auto shrink-0" />
        {onRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className={cn(
              "p-1 rounded shrink-0",
              "text-[var(--text-muted)] hover:text-red-400",
              "hover:bg-red-500/10",
              "transition-colors duration-150"
            )}
            title="Remove change"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div data-selectable className={cn("rounded-lg border p-4", config.bg, config.border)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {collapsible && (
            <button
              onClick={() => setCollapsed(true)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0 -ml-1"
              title="Collapse"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
          <span className={cn("px-2 py-0.5 rounded text-xs font-mono font-medium", config.badge)}>
            {config.label}
          </span>
          <span className="text-sm text-[var(--text-secondary)]">
            {schema}.{table}
          </span>
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            className={cn(
              "p-1.5 rounded-lg shrink-0",
              "text-[var(--text-muted)] hover:text-red-400",
              "hover:bg-red-500/10",
              "transition-colors duration-150"
            )}
            title="Remove change"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Body */}
      {type === "update" && originalData ? (
        <UpdateDiffTable data={data} originalData={originalData} />
      ) : type === "insert" ? (
        <PropertyTable data={data} variant="insert" />
      ) : (
        <PropertyTable data={data} variant="delete" />
      )}

      {/* Show SQL toggle */}
      <button
        onClick={() => setShowSql(!showSql)}
        className={cn(
          "flex items-center gap-1.5 mt-3 px-2 py-1 rounded text-xs",
          "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
          "hover:bg-[var(--bg-tertiary)]",
          "transition-colors duration-150"
        )}
      >
        {showSql ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Code className="w-3 h-3" />
        <span>SQL</span>
      </button>
      {showSql && (
        <pre className={cn(
          "mt-2 text-xs font-mono p-3 rounded-md overflow-x-auto",
          "bg-[var(--bg-primary)] text-[var(--text-primary)]",
          "border border-[var(--border-color)]"
        )}>
          {sql}
        </pre>
      )}
    </div>
  );
}

function UpdateDiffTable({ data, originalData }: { data: Row; originalData: Row }) {
  const changedFields = Object.keys(data).filter((key) => {
    const oldVal = formatCellValue(originalData[key]);
    const newVal = formatCellValue(data[key]);
    return oldVal !== newVal;
  });

  if (changedFields.length === 0) {
    return (
      <div className="text-xs text-[var(--text-muted)] italic">No visible changes</div>
    );
  }

  return (
    <div className="rounded-md border border-[var(--border-color)] overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[var(--bg-tertiary)]">
            <th className="text-left px-3 py-1.5 font-medium text-[var(--text-secondary)] w-1/4">Field</th>
            <th className="text-left px-3 py-1.5 font-medium text-red-400 w-[37.5%]">Before</th>
            <th className="text-left px-3 py-1.5 font-medium text-green-400 w-[37.5%]">After</th>
          </tr>
        </thead>
        <tbody>
          {changedFields.map((field) => (
            <tr key={field} className="border-t border-[var(--border-color)]">
              <td className="px-3 py-1.5 font-mono text-[var(--text-secondary)]">{field}</td>
              <td className="px-3 py-1.5 font-mono bg-red-500/8 text-red-300">
                {formatCellValue(originalData[field])}
              </td>
              <td className="px-3 py-1.5 font-mono bg-green-500/8 text-green-300">
                {formatCellValue(data[field])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PropertyTable({ data, variant }: { data: Row; variant: "insert" | "delete" }) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined);
  const bgClass = variant === "insert" ? "bg-green-500/8" : "bg-red-500/8";
  const textClass = variant === "insert" ? "text-green-300" : "text-red-300";

  if (entries.length === 0) {
    return <div className="text-xs text-[var(--text-muted)] italic">Empty row</div>;
  }

  return (
    <div className="rounded-md border border-[var(--border-color)] overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[var(--bg-tertiary)]">
            <th className="text-left px-3 py-1.5 font-medium text-[var(--text-secondary)] w-1/3">Field</th>
            <th className="text-left px-3 py-1.5 font-medium text-[var(--text-secondary)] w-2/3">Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([field, value]) => (
            <tr key={field} className={cn("border-t border-[var(--border-color)]", bgClass)}>
              <td className="px-3 py-1.5 font-mono text-[var(--text-secondary)]">{field}</td>
              <td className={cn("px-3 py-1.5 font-mono", textClass)}>
                {formatCellValue(value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
