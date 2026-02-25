import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Key, Link } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatRowCount, type TableNodeData } from "./diagramUtils";

function TableNodeComponent({ data }: NodeProps) {
  const { schema, table, columns, rowCount, schemaColor } = data as TableNodeData;

  return (
    <div
      className={cn(
        "rounded-lg border shadow-lg min-w-[260px] max-w-[320px]",
        "bg-[var(--bg-primary)] overflow-hidden",
      )}
      style={{ borderColor: schemaColor.border + "60" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{
          backgroundColor: schemaColor.bg,
          borderColor: schemaColor.border + "30",
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: schemaColor.accent }}
          />
          <span
            className="text-[11px] font-medium truncate"
            style={{ color: schemaColor.text }}
          >
            {schema}
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">.</span>
          <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
            {table}
          </span>
        </div>
        {rowCount != null && (
          <span className="text-[10px] text-[var(--text-muted)] ml-2 shrink-0 tabular-nums">
            {formatRowCount(rowCount)}
          </span>
        )}
      </div>

      {/* Columns */}
      <div className="divide-y divide-[var(--border-color)]/30">
        {columns.map((col, i) => (
          <div
            key={col.name}
            className={cn(
              "relative flex items-center gap-2 px-3 py-1.5 text-[12px]",
              i % 2 === 0 ? "bg-transparent" : "bg-[var(--bg-secondary)]/30",
              col.isForeignKey && "bg-[var(--accent)]/[0.04]",
            )}
          >
            {/* Target handle for columns that may be FK targets */}
            <Handle
              type="target"
              position={Position.Left}
              id={`${schema}.${table}-${col.name}-target`}
              className="!w-2 !h-2 !bg-yellow-500 !border-yellow-600"
              style={{ opacity: col.isPrimaryKey ? 1 : 0, pointerEvents: 'none' }}
            />

            {/* Icon */}
            <span className="w-4 shrink-0 flex items-center justify-center">
              {col.isPrimaryKey ? (
                <Key className="w-3 h-3 text-yellow-500" />
              ) : col.isForeignKey ? (
                <Link className="w-3 h-3 text-[var(--accent)]" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]/30" />
              )}
            </span>

            {/* Column name */}
            <span
              className={cn(
                "font-mono truncate",
                col.isPrimaryKey
                  ? "font-semibold text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)]",
                col.isNullable && !col.isPrimaryKey && "text-[var(--text-muted)]",
              )}
            >
              {col.name}
            </span>

            {/* Spacer */}
            <span className="flex-1" />

            {/* Data type */}
            <span
              className="font-mono text-[11px] text-[var(--text-muted)] truncate max-w-[100px]"
              title={col.enumValues?.length ? `Enum: ${col.enumValues.join(", ")}` : undefined}
            >
              {col.dataType}
            </span>

            {/* Badges */}
            {col.isPrimaryKey && (
              <span className="text-[9px] font-bold text-yellow-500 shrink-0">
                PK
              </span>
            )}
            {col.isForeignKey && (
              <span className="text-[9px] font-bold text-[var(--accent)] shrink-0">
                FK
              </span>
            )}
            {col.isUnique && !col.isPrimaryKey && (
              <span className="text-[9px] font-bold text-emerald-400 shrink-0">
                UQ
              </span>
            )}

            {/* Source handle for FK columns (right side) */}
            {col.isForeignKey && col.foreignKeyTarget && (
              <Handle
                type="source"
                position={Position.Right}
                id={`${schema}.${table}-${col.name}-source`}
                className="!w-2 !h-2 !bg-[var(--accent)] !border-[var(--accent)]"
              />
            )}
          </div>
        ))}

        {columns.length === 0 && (
          <div className="px-3 py-3 text-[12px] text-[var(--text-muted)] italic text-center">
            No columns loaded
          </div>
        )}
      </div>
    </div>
  );
}

export const TableNode = memo(TableNodeComponent);
