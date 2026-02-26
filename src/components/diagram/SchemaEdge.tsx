import { memo, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import type { SchemaEdgeData } from "./diagramUtils";

function SchemaEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
  style,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const edgeData = data as SchemaEdgeData | undefined;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      {/* Invisible wider path for easier hover */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: hovered ? "var(--accent)" : (edgeData?.schemaColor || "var(--text-muted)"),
          strokeWidth: hovered ? 2 : 1,
          opacity: hovered ? 1 : 0.4,
          transition: "stroke 0.15s, stroke-width 0.15s, opacity 0.15s",
          strokeDasharray: hovered ? "6 3" : "none",
          animation: hovered ? "dashFlow 0.5s linear infinite" : "none",
        }}
      />
      {hovered && edgeData && (
        <EdgeLabelRenderer>
          <div
            className="absolute px-2 py-1 rounded-md text-[11px] font-mono bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] shadow-lg pointer-events-none"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            {edgeData.sourceColumn} → {edgeData.targetColumn}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const SchemaEdge = memo(SchemaEdgeComponent);
