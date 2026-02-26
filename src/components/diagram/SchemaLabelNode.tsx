import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

export interface SchemaLabelNodeData {
  label: string;
  color: string;
  tableCount: number;
  [key: string]: unknown;
}

function SchemaLabelNodeComponent({ data }: NodeProps) {
  const { label, color, tableCount } = data as SchemaLabelNodeData;

  return (
    <div className="flex items-center gap-2.5 pointer-events-none select-none">
      <div
        className="w-3 h-3 rounded-sm"
        style={{ backgroundColor: color }}
      />
      <span
        className="text-base font-semibold tracking-wide"
        style={{ color }}
      >
        {label}
      </span>
      <span className="text-xs text-[var(--text-muted)]">
        {tableCount} {tableCount === 1 ? "table" : "tables"}
      </span>
    </div>
  );
}

export const SchemaLabelNode = memo(SchemaLabelNodeComponent);
