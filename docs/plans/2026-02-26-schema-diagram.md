# Schema Diagram Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an interactive, node-based database schema diagram that visualizes tables, columns, and foreign key relationships using React Flow.

**Architecture:** New `"diagram"` tab type rendered by a `DiagramTab` component. Uses `@xyflow/react` for the interactive canvas and `@dagrejs/dagre` for automatic node layout. Custom `TableNode` components show full column detail with PK/FK icons. Edges represent FK relationships with hover labels. Toolbar provides search, schema filter, fit-view, and PNG export.

**Tech Stack:** `@xyflow/react` v12, `@dagrejs/dagre`, React 19, TypeScript, Tailwind CSS v4, Zustand v5, TanStack React Query v5

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install React Flow and Dagre**

```bash
bun add @xyflow/react @dagrejs/dagre
bun add -d @types/dagre
```

**Step 2: Verify installation**

```bash
bun run build
```

Expected: Build succeeds with no errors.

**Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add @xyflow/react and @dagrejs/dagre dependencies"
```

---

### Task 2: Add `"diagram"` Tab Type and UI Store Action

**Files:**
- Modify: `src/types/index.ts:118-128`
- Modify: `src/stores/uiStore.ts` (UIState interface + implementation)

**Step 1: Add `"diagram"` to the Tab type union**

In `src/types/index.ts`, find the `Tab` interface (line 118):

```typescript
export interface Tab {
  id: string;
  type: "table" | "query" | "create-table" | "edit-table" | "import-data" | "history" | "staged-changes" | "diagram";
  title: string;
  schema?: string;
  table?: string;
  queryContent?: string;
  createTableSchema?: string;
  importFormat?: "csv" | "json";
  pinned?: boolean;
}
```

Only change: add `| "diagram"` to the `type` union.

**Step 2: Add `addDiagramTab` action to uiStore**

In `src/stores/uiStore.ts`, add to the `UIState` interface (after `addStagedChangesTab` around line 126):

```typescript
addDiagramTab: () => void;
```

Then add the implementation (after the `addStagedChangesTab` implementation around line 468):

```typescript
addDiagramTab: () =>
  set((state) => {
    const existing = state.tabs.find((t) => t.type === "diagram");
    if (existing) {
      return { activeTabId: existing.id };
    }
    const newTab: Tab = {
      id: `diagram-${Date.now()}`,
      type: "diagram",
      title: "Schema Diagram",
    };
    return {
      tabs: [...state.tabs, newTab],
      activeTabId: newTab.id,
    };
  }),
```

**Step 3: Verify build**

```bash
bun run build
```

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/types/index.ts src/stores/uiStore.ts
git commit -m "feat: add diagram tab type and addDiagramTab store action"
```

---

### Task 3: Create `diagramUtils.ts` — Color Palette and Node/Edge Builders

**Files:**
- Create: `src/components/diagram/diagramUtils.ts`

**Step 1: Create the utility file**

```typescript
import type { Node, Edge, MarkerType } from "@xyflow/react";

// Schema color palette — each schema gets a consistent color
const SCHEMA_COLORS = [
  { bg: "rgba(59, 130, 246, 0.15)", border: "#3b82f6", text: "#60a5fa", accent: "#3b82f6" },   // blue
  { bg: "rgba(16, 185, 129, 0.15)", border: "#10b981", text: "#34d399", accent: "#10b981" },   // emerald
  { bg: "rgba(245, 158, 11, 0.15)", border: "#f59e0b", text: "#fbbf24", accent: "#f59e0b" },   // amber
  { bg: "rgba(168, 85, 247, 0.15)", border: "#a855f7", text: "#c084fc", accent: "#a855f7" },   // purple
  { bg: "rgba(239, 68, 68, 0.15)", border: "#ef4444", text: "#f87171", accent: "#ef4444" },    // red
  { bg: "rgba(236, 72, 153, 0.15)", border: "#ec4899", text: "#f472b6", accent: "#ec4899" },   // pink
  { bg: "rgba(20, 184, 166, 0.15)", border: "#14b8a6", text: "#2dd4bf", accent: "#14b8a6" },   // teal
  { bg: "rgba(249, 115, 22, 0.15)", border: "#f97316", text: "#fb923c", accent: "#f97316" },   // orange
];

export type SchemaColor = (typeof SCHEMA_COLORS)[number];

export function getSchemaColor(schemaName: string, schemaNames: string[]): SchemaColor {
  const index = schemaNames.indexOf(schemaName);
  return SCHEMA_COLORS[index % SCHEMA_COLORS.length];
}

export function getSchemaColorMap(schemaNames: string[]): Record<string, SchemaColor> {
  const map: Record<string, SchemaColor> = {};
  schemaNames.forEach((name, i) => {
    map[name] = SCHEMA_COLORS[i % SCHEMA_COLORS.length];
  });
  return map;
}

// Column info as used inside the diagram (slimmed down from FullColumnInfo)
export interface DiagramColumn {
  name: string;
  dataType: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isNullable: boolean;
  isUnique: boolean;
  foreignKeyTarget?: {
    schema: string;
    table: string;
    column: string;
  };
  enumValues?: string[];
}

export interface TableNodeData {
  schema: string;
  table: string;
  columns: DiagramColumn[];
  rowCount?: number;
  schemaColor: SchemaColor;
  [key: string]: unknown;
}

export interface SchemaEdgeData {
  constraintName: string;
  sourceColumn: string;
  targetColumn: string;
  [key: string]: unknown;
}

// Format row count for display (e.g., 12345 → "12.3k")
export function formatRowCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
}

// Build React Flow nodes from schema data
export function buildNodes(
  schemas: { name: string; tables: { name: string; schema: string; rowCount?: number }[] }[],
  columnsMap: Map<string, DiagramColumn[]>,
  schemaColorMap: Record<string, SchemaColor>,
): Node<TableNodeData>[] {
  const nodes: Node<TableNodeData>[] = [];

  for (const schema of schemas) {
    for (const table of schema.tables) {
      const key = `${schema.name}.${table.name}`;
      const columns = columnsMap.get(key) ?? [];

      nodes.push({
        id: key,
        type: "tableNode",
        position: { x: 0, y: 0 }, // Dagre will set this
        data: {
          schema: schema.name,
          table: table.name,
          columns,
          rowCount: table.rowCount,
          schemaColor: schemaColorMap[schema.name],
        },
      });
    }
  }

  return nodes;
}

// Build React Flow edges from foreign key relationships
export function buildEdges(
  nodes: Node<TableNodeData>[],
): Edge<SchemaEdgeData>[] {
  const edges: Edge<SchemaEdgeData>[] = [];
  const edgeIds = new Set<string>();

  for (const node of nodes) {
    const data = node.data;
    for (const col of data.columns) {
      if (col.isForeignKey && col.foreignKeyTarget) {
        const targetId = `${col.foreignKeyTarget.schema}.${col.foreignKeyTarget.table}`;
        // Only add edge if target node exists
        if (nodes.some((n) => n.id === targetId)) {
          const edgeId = `${node.id}.${col.name}->${targetId}.${col.foreignKeyTarget.column}`;
          if (!edgeIds.has(edgeId)) {
            edgeIds.add(edgeId);
            edges.push({
              id: edgeId,
              source: node.id,
              target: targetId,
              sourceHandle: `${node.id}-${col.name}-source`,
              targetHandle: `${targetId}-${col.foreignKeyTarget.column}-target`,
              type: "schemaEdge",
              data: {
                constraintName: "",
                sourceColumn: col.name,
                targetColumn: col.foreignKeyTarget.column,
              },
              markerEnd: {
                type: "arrowclosed" as unknown as MarkerType,
                width: 16,
                height: 16,
              },
            });
          }
        }
      }
    }
  }

  return edges;
}
```

**Step 2: Verify build**

```bash
bun run build
```

Expected: Build succeeds (file is not imported yet, just created).

**Step 3: Commit**

```bash
git add src/components/diagram/diagramUtils.ts
git commit -m "feat: add diagram utility functions for colors, node/edge building"
```

---

### Task 4: Create `useAutoLayout.ts` — Dagre Layout Hook

**Files:**
- Create: `src/components/diagram/useAutoLayout.ts`

**Step 1: Create the auto-layout hook**

```typescript
import { useCallback } from "react";
import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { TableNodeData } from "./diagramUtils";

// Estimate node dimensions based on column count
function getNodeDimensions(node: Node<TableNodeData>): { width: number; height: number } {
  const columnCount = node.data.columns.length;
  const headerHeight = 40;
  const columnHeight = 28;
  const padding = 8;

  return {
    width: 280,
    height: headerHeight + columnCount * columnHeight + padding,
  };
}

export function useAutoLayout() {
  const getLayoutedElements = useCallback(
    (nodes: Node<TableNodeData>[], edges: Edge[]) => {
      const g = new dagre.graphlib.Graph();
      g.setDefaultEdgeLabel(() => ({}));
      g.setGraph({
        rankdir: "LR",
        nodesep: 80,
        ranksep: 200,
        marginx: 50,
        marginy: 50,
      });

      // Add nodes with dimensions
      for (const node of nodes) {
        const { width, height } = getNodeDimensions(node);
        g.setNode(node.id, { width, height });
      }

      // Add edges
      for (const edge of edges) {
        g.setEdge(edge.source, edge.target);
      }

      dagre.layout(g);

      const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = g.node(node.id);
        const { width, height } = getNodeDimensions(node);

        return {
          ...node,
          position: {
            x: nodeWithPosition.x - width / 2,
            y: nodeWithPosition.y - height / 2,
          },
        };
      });

      return { nodes: layoutedNodes, edges };
    },
    [],
  );

  return { getLayoutedElements };
}
```

**Step 2: Verify build**

```bash
bun run build
```

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/diagram/useAutoLayout.ts
git commit -m "feat: add dagre auto-layout hook for schema diagram"
```

---

### Task 5: Create `TableNode.tsx` — Custom React Flow Node

**Files:**
- Create: `src/components/diagram/TableNode.tsx`

**Step 1: Create the TableNode component**

This is a custom React Flow node that renders a table with its full column detail. Each FK column gets a source handle on the right; each PK column gets a target handle on the left.

```typescript
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
            {/* Target handle for PK columns (left side) */}
            {col.isPrimaryKey && (
              <Handle
                type="target"
                position={Position.Left}
                id={`${schema}.${table}-${col.name}-target`}
                className="!w-2 !h-2 !bg-yellow-500 !border-yellow-600"
                style={{ top: "50%" }}
              />
            )}

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
                col.isNullable && "text-[var(--text-muted)]",
              )}
            >
              {col.name}
            </span>

            {/* Spacer */}
            <span className="flex-1" />

            {/* Data type */}
            <span className="font-mono text-[11px] text-[var(--text-muted)] truncate max-w-[100px]">
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
                style={{ top: "50%" }}
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
```

**Step 2: Verify build**

```bash
bun run build
```

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/diagram/TableNode.tsx
git commit -m "feat: add custom TableNode component for schema diagram"
```

---

### Task 6: Create `SchemaEdge.tsx` — Custom FK Edge with Hover Labels

**Files:**
- Create: `src/components/diagram/SchemaEdge.tsx`

**Step 1: Create the SchemaEdge component**

```typescript
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
          stroke: hovered ? "var(--accent)" : "var(--text-muted)",
          strokeWidth: hovered ? 2 : 1,
          opacity: hovered ? 1 : 0.4,
          transition: "stroke 0.15s, stroke-width 0.15s, opacity 0.15s",
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
```

**Step 2: Verify build**

```bash
bun run build
```

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/diagram/SchemaEdge.tsx
git commit -m "feat: add custom SchemaEdge component with hover labels"
```

---

### Task 7: Create `DiagramToolbar.tsx` — Search, Filter, Fit, Export

**Files:**
- Create: `src/components/diagram/DiagramToolbar.tsx`

**Step 1: Create the toolbar component**

```typescript
import { useState, useRef, useEffect } from "react";
import {
  Search,
  RotateCcw,
  Maximize2,
  Camera,
  ChevronDown,
  Check,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface DiagramToolbarProps {
  schemaNames: string[];
  visibleSchemas: Set<string>;
  onToggleSchema: (schema: string) => void;
  onShowAllSchemas: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onResetLayout: () => void;
  onFitView: () => void;
  onExportPng: () => void;
}

export function DiagramToolbar({
  schemaNames,
  visibleSchemas,
  onToggleSchema,
  onShowAllSchemas,
  searchQuery,
  onSearchChange,
  onResetLayout,
  onFitView,
  onExportPng,
}: DiagramToolbarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    if (filterOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [filterOpen]);

  const allVisible = visibleSchemas.size === schemaNames.length;

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search tables..."
          className={cn(
            "w-full pl-8 pr-8 py-1.5 rounded-lg text-xs",
            "bg-[var(--bg-primary)] border border-[var(--border-color)]",
            "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
            "focus:outline-none focus:border-[var(--accent)]/50",
          )}
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Schema filter dropdown */}
      {schemaNames.length > 1 && (
        <div ref={filterRef} className="relative">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs",
              "border border-[var(--border-color)]",
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              "hover:bg-[var(--bg-tertiary)] transition-colors",
              !allVisible && "border-[var(--accent)]/40 text-[var(--accent)]",
            )}
          >
            Schema: {allVisible ? "All" : `${visibleSchemas.size}/${schemaNames.length}`}
            <ChevronDown className="w-3 h-3" />
          </button>
          {filterOpen && (
            <div className="absolute top-full mt-1 right-0 z-50 w-48 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl py-1">
              <button
                onClick={onShowAllSchemas}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left",
                  "hover:bg-[var(--bg-tertiary)] transition-colors",
                  allVisible
                    ? "text-[var(--accent)]"
                    : "text-[var(--text-secondary)]",
                )}
              >
                <Check
                  className={cn("w-3 h-3", allVisible ? "opacity-100" : "opacity-0")}
                />
                Show All
              </button>
              <div className="h-px bg-[var(--border-color)] my-1" />
              {schemaNames.map((name) => (
                <button
                  key={name}
                  onClick={() => onToggleSchema(name)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left",
                    "hover:bg-[var(--bg-tertiary)] transition-colors",
                    visibleSchemas.has(name)
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-muted)]",
                  )}
                >
                  <Check
                    className={cn(
                      "w-3 h-3",
                      visibleSchemas.has(name) ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action buttons */}
      <button
        onClick={onResetLayout}
        title="Reset layout"
        className={cn(
          "p-1.5 rounded-lg text-[var(--text-muted)]",
          "hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]",
          "transition-colors",
        )}
      >
        <RotateCcw className="w-4 h-4" />
      </button>
      <button
        onClick={onFitView}
        title="Fit to view"
        className={cn(
          "p-1.5 rounded-lg text-[var(--text-muted)]",
          "hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]",
          "transition-colors",
        )}
      >
        <Maximize2 className="w-4 h-4" />
      </button>
      <button
        onClick={onExportPng}
        title="Export as PNG"
        className={cn(
          "p-1.5 rounded-lg text-[var(--text-muted)]",
          "hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]",
          "transition-colors",
        )}
      >
        <Camera className="w-4 h-4" />
      </button>
    </div>
  );
}
```

**Step 2: Verify build**

```bash
bun run build
```

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/diagram/DiagramToolbar.tsx
git commit -m "feat: add DiagramToolbar with search, schema filter, and action buttons"
```

---

### Task 8: Create `DiagramTab.tsx` — Main Container Component

**Files:**
- Create: `src/components/diagram/DiagramTab.tsx`
- Create: `src/components/diagram/index.ts`

This is the most complex component. It:
1. Fetches column data for all tables using `invoke("get_columns", ...)`
2. Builds nodes and edges from the data
3. Runs dagre layout
4. Renders React Flow with TableNode, SchemaEdge, MiniMap, Controls, Background
5. Implements search highlight, schema filter, hover connectivity highlight, click-to-open

**Step 1: Create `DiagramTab.tsx`**

```typescript
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { Loader2 } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useUIStore } from "../../stores/uiStore";
import { getCurrentConnectionId, type FullColumnInfo } from "../../hooks/useDatabase";
import { cn } from "../../lib/utils";
import { TableNode } from "./TableNode";
import { SchemaEdge } from "./SchemaEdge";
import { DiagramToolbar } from "./DiagramToolbar";
import { useAutoLayout } from "./useAutoLayout";
import {
  buildNodes,
  buildEdges,
  getSchemaColorMap,
  type DiagramColumn,
  type TableNodeData,
} from "./diagramUtils";

const nodeTypes = { tableNode: TableNode };
const edgeTypes = { schemaEdge: SchemaEdge };

function convertColumns(raw: FullColumnInfo[]): DiagramColumn[] {
  return raw.map((c) => ({
    name: c.name,
    dataType: c.data_type,
    isPrimaryKey: c.is_primary_key,
    isForeignKey: c.is_foreign_key,
    isNullable: c.is_nullable,
    isUnique: c.is_unique,
    foreignKeyTarget: c.foreign_key_info
      ? {
          schema: c.foreign_key_info.referenced_schema,
          table: c.foreign_key_info.referenced_table,
          column: c.foreign_key_info.referenced_column,
        }
      : undefined,
    enumValues: c.enum_values ?? undefined,
  }));
}

function DiagramCanvas() {
  const schemas = useProjectStore((s) => s.schemas);
  const addTab = useUIStore((s) => s.addTab);
  const { fitView, getNodes } = useReactFlow();
  const { getLayoutedElements } = useAutoLayout();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TableNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Loading state
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState({ loaded: 0, total: 0 });

  // Toolbar state
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleSchemas, setVisibleSchemas] = useState<Set<string>>(new Set());
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Track the full unfiltered set
  const allNodesRef = useRef<Node<TableNodeData>[]>([]);
  const allEdgesRef = useRef<Edge[]>([]);

  const schemaNames = useMemo(() => schemas.map((s) => s.name), [schemas]);

  // Initialize visible schemas
  useEffect(() => {
    setVisibleSchemas(new Set(schemaNames));
  }, [schemaNames]);

  // Fetch all column data and build diagram
  useEffect(() => {
    const connectionId = getCurrentConnectionId();
    if (!connectionId || schemas.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadDiagram() {
      const allTables: { schema: string; table: string }[] = [];
      for (const schema of schemas) {
        for (const table of schema.tables) {
          allTables.push({ schema: schema.name, table: table.name });
        }
      }

      setLoadProgress({ loaded: 0, total: allTables.length });

      // Fetch columns for all tables in parallel (batched)
      const columnsMap = new Map<string, DiagramColumn[]>();
      const BATCH_SIZE = 10;

      for (let i = 0; i < allTables.length; i += BATCH_SIZE) {
        if (cancelled) return;
        const batch = allTables.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map((t) =>
            invoke<FullColumnInfo[]>("get_columns", {
              connectionId,
              schema: t.schema,
              table: t.table,
            }).then((cols) => ({
              key: `${t.schema}.${t.table}`,
              columns: convertColumns(cols),
            })),
          ),
        );

        for (const result of results) {
          if (result.status === "fulfilled") {
            columnsMap.set(result.value.key, result.value.columns);
          }
        }

        if (!cancelled) {
          setLoadProgress({ loaded: Math.min(i + BATCH_SIZE, allTables.length), total: allTables.length });
        }
      }

      if (cancelled) return;

      const schemaColorMap = getSchemaColorMap(schemaNames);
      const builtNodes = buildNodes(schemas, columnsMap, schemaColorMap);
      const builtEdges = buildEdges(builtNodes);

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        builtNodes,
        builtEdges,
      );

      allNodesRef.current = layoutedNodes;
      allEdgesRef.current = layoutedEdges;

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      setLoading(false);

      // Fit view after a short delay for React Flow to render
      setTimeout(() => fitView({ padding: 0.1 }), 100);
    }

    loadDiagram();
    return () => { cancelled = true; };
  }, [schemas, schemaNames, getLayoutedElements, setNodes, setEdges, fitView]);

  // Apply search and schema filters
  useEffect(() => {
    if (loading) return;

    const lowerSearch = searchQuery.toLowerCase();

    const filteredNodes = allNodesRef.current.filter((node) => {
      const data = node.data as TableNodeData;
      // Schema filter
      if (!visibleSchemas.has(data.schema)) return false;
      // Search filter
      if (lowerSearch && !`${data.schema}.${data.table}`.toLowerCase().includes(lowerSearch)) {
        return false;
      }
      return true;
    });

    const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));

    const filteredEdges = allEdgesRef.current.filter(
      (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target),
    );

    // Apply hover highlighting
    const styledNodes = filteredNodes.map((node) => {
      if (!hoveredNodeId) return node;
      const isHovered = node.id === hoveredNodeId;
      const isConnected = filteredEdges.some(
        (e) =>
          (e.source === hoveredNodeId && e.target === node.id) ||
          (e.target === hoveredNodeId && e.source === node.id),
      );
      return {
        ...node,
        style: {
          ...node.style,
          opacity: isHovered || isConnected ? 1 : 0.25,
          transition: "opacity 0.2s",
        },
      };
    });

    const styledEdges = filteredEdges.map((edge) => {
      if (!hoveredNodeId) return edge;
      const isConnected =
        edge.source === hoveredNodeId || edge.target === hoveredNodeId;
      return {
        ...edge,
        style: {
          ...edge.style,
          opacity: isConnected ? 1 : 0.1,
        },
      };
    });

    setNodes(styledNodes);
    setEdges(styledEdges);
  }, [searchQuery, visibleSchemas, hoveredNodeId, loading, setNodes, setEdges]);

  // Handlers
  const handleNodeMouseEnter: NodeMouseHandler = useCallback((_event, node) => {
    setHoveredNodeId(node.id);
  }, []);

  const handleNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      const data = node.data as TableNodeData;
      addTab({
        id: crypto.randomUUID(),
        type: "table",
        title: data.table,
        schema: data.schema,
        table: data.table,
      });
    },
    [addTab],
  );

  const handleResetLayout = useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      allNodesRef.current,
      allEdgesRef.current,
    );
    allNodesRef.current = layoutedNodes;
    allEdgesRef.current = layoutedEdges;
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    setTimeout(() => fitView({ padding: 0.1 }), 50);
  }, [getLayoutedElements, setNodes, setEdges, fitView]);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.1, duration: 300 });
  }, [fitView]);

  const handleExportPng = useCallback(async () => {
    try {
      // Use the built-in toImage from React Flow via the viewport
      const flowElement = document.querySelector(".react-flow") as HTMLElement;
      if (!flowElement) return;

      // Use html-to-image or React Flow's built-in approach
      // For simplicity, use canvas-based export
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(flowElement, {
        backgroundColor: "var(--bg-primary)",
        quality: 1,
      });

      const filePath = await save({
        defaultPath: "schema-diagram.png",
        filters: [{ name: "PNG Image", extensions: ["png"] }],
      });

      if (filePath) {
        const base64 = dataUrl.split(",")[1];
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        await writeFile(filePath, bytes);
      }
    } catch (err) {
      console.error("Failed to export diagram:", err);
    }
  }, []);

  const handleToggleSchema = useCallback((schema: string) => {
    setVisibleSchemas((prev) => {
      const next = new Set(prev);
      if (next.has(schema)) {
        next.delete(schema);
      } else {
        next.add(schema);
      }
      return next;
    });
  }, []);

  const handleShowAllSchemas = useCallback(() => {
    setVisibleSchemas(new Set(schemaNames));
  }, [schemaNames]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
        <Loader2 className="w-6 h-6 animate-spin" />
        <div className="text-sm">
          Loading schema diagram...
          {loadProgress.total > 0 && (
            <span className="ml-1 tabular-nums">
              ({loadProgress.loaded}/{loadProgress.total} tables)
            </span>
          )}
        </div>
      </div>
    );
  }

  if (allNodesRef.current.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm">
        No tables found in the database.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <DiagramToolbar
        schemaNames={schemaNames}
        visibleSchemas={visibleSchemas}
        onToggleSchema={handleToggleSchema}
        onShowAllSchemas={handleShowAllSchemas}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onResetLayout={handleResetLayout}
        onFitView={handleFitView}
        onExportPng={handleExportPng}
      />
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeMouseEnter={handleNodeMouseEnter}
          onNodeMouseLeave={handleNodeMouseLeave}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          className="bg-[var(--bg-primary)]"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="var(--text-muted)"
            style={{ opacity: 0.15 }}
          />
          <Controls
            showInteractive={false}
            className="!bg-[var(--bg-secondary)] !border-[var(--border-color)] !shadow-lg [&>button]:!bg-[var(--bg-secondary)] [&>button]:!border-[var(--border-color)] [&>button]:!text-[var(--text-muted)] [&>button:hover]:!bg-[var(--bg-tertiary)]"
          />
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="!bg-[var(--bg-secondary)] !border-[var(--border-color)]"
          />
        </ReactFlow>
      </div>
    </div>
  );
}

export function DiagramTab() {
  return (
    <ReactFlowProvider>
      <DiagramCanvas />
    </ReactFlowProvider>
  );
}
```

**Step 2: Create `index.ts` barrel export**

```typescript
export { DiagramTab } from "./DiagramTab";
```

**Step 3: Verify build**

```bash
bun run build
```

Expected: May fail if `html-to-image` is not installed. That's OK — we'll address the PNG export in Task 10.

**Step 4: Commit**

```bash
git add src/components/diagram/
git commit -m "feat: add DiagramTab main container with React Flow canvas"
```

---

### Task 9: Wire DiagramTab into TabContent and TabBar

**Files:**
- Modify: `src/components/layout/TabContent.tsx:3883-3884`
- Modify: `src/components/layout/TabBar.tsx:8-21`

**Step 1: Add diagram case to TabContent**

In `src/components/layout/TabContent.tsx`, add the import at the top (near other tab imports around line 70):

```typescript
import { DiagramTab } from "../diagram";
```

Then add the diagram case in the tab type if/else chain (after the `staged-changes` case around line 3883):

```typescript
        } else if (tab.type === "staged-changes") {
          content = <StagedChangesTab key={tab.id} tab={tab} />;
        } else if (tab.type === "diagram") {
          content = <DiagramTab key={tab.id} />;
        }
```

**Step 2: Add diagram icon to TabBar**

In `src/components/layout/TabBar.tsx`, import `GitBranch` (or `Workflow`) from lucide-react on line 2:

```typescript
import { X, Table2, FileCode, ChevronLeft, ChevronRight, Database, FileUp, Pencil, XCircle, Pin, PinOff, Workflow } from "lucide-react";
```

Add the diagram case in `getTabIcon` (around line 17):

```typescript
    case "edit-table":
      return Pencil;
    case "diagram":
      return Workflow;
    default:
```

**Step 3: Verify build**

```bash
bun run build
```

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/components/layout/TabContent.tsx src/components/layout/TabBar.tsx
git commit -m "feat: wire DiagramTab into tab system"
```

---

### Task 10: Install html-to-image for PNG Export

The `DiagramTab` uses `html-to-image` for PNG export. Install it and also install the Tauri plugin dependencies if not already present.

**Files:**
- Modify: `package.json`

**Step 1: Install html-to-image**

```bash
bun add html-to-image
```

**Step 2: Check if Tauri dialog and fs plugins are already available**

```bash
grep -q "@tauri-apps/plugin-dialog" package.json && echo "dialog plugin installed" || echo "NOT installed"
grep -q "@tauri-apps/plugin-fs" package.json && echo "fs plugin installed" || echo "NOT installed"
```

If either is not installed:
```bash
bun add @tauri-apps/plugin-dialog @tauri-apps/plugin-fs
```

**Step 3: If dialog/fs plugins are not registered in Tauri config, update `DiagramTab.tsx` to use a simpler export approach**

If the plugins aren't available, replace the PNG export with a simple download approach that creates a blob URL and triggers a download via an anchor tag. Update `handleExportPng` in `DiagramTab.tsx`:

```typescript
const handleExportPng = useCallback(async () => {
  try {
    const flowElement = document.querySelector(".react-flow") as HTMLElement;
    if (!flowElement) return;

    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(flowElement, {
      backgroundColor: "#1a1a2e",
      quality: 1,
    });

    // Fallback: download via anchor tag
    const link = document.createElement("a");
    link.download = "schema-diagram.png";
    link.href = dataUrl;
    link.click();
  } catch (err) {
    console.error("Failed to export diagram:", err);
  }
}, []);
```

**Step 4: Verify build**

```bash
bun run build
```

Expected: Build succeeds.

**Step 5: Commit**

```bash
git add package.json bun.lock src/components/diagram/DiagramTab.tsx
git commit -m "feat: add html-to-image for diagram PNG export"
```

---

### Task 11: Add Access Points — Command Palette, Sidebar Context Menu, Keyboard Shortcut

**Files:**
- Modify: `src/components/ui/CommandPalette.tsx:34-97`
- Modify: `src/components/layout/Sidebar.tsx:156-208`
- Modify: `src/components/layout/AppLayout.tsx` (keyboard shortcut handler)

**Step 1: Add "Schema Diagram" command to CommandPalette**

In `src/components/ui/CommandPalette.tsx`, import `Workflow` from lucide-react. Then inside the `commands` useMemo (around line 46, inside the `if (connectionStatus === "connected")` block), add:

```typescript
      cmds.push({
        id: "schema-diagram",
        label: "Open Schema Diagram",
        shortcut: "⌘⇧D",
        action: () => addDiagramTab(),
        category: "navigation",
      });
```

Update the destructure on line 25 to also grab `addDiagramTab`:

```typescript
  const { commandPaletteOpen, toggleCommandPalette, openProjectModal, addTab, addDiagramTab } =
    useUIStore();
```

**Step 2: Add "Schema Diagram" to sidebar schema context menu**

In `src/components/layout/Sidebar.tsx`, in the `SchemaTree` component's `ContextMenu` items array (around line 157), add a new entry after "Schema Info":

```typescript
        {
          label: "Schema Diagram",
          icon: <Workflow className="w-4 h-4" />,
          onClick: () => addDiagramTab(),
        },
```

Import `Workflow` from lucide-react and `addDiagramTab` from the uiStore.

**Step 3: Add keyboard shortcut `Cmd+Shift+D`**

In the keyboard event handler (likely in `AppLayout.tsx` or wherever global shortcuts are handled), add:

```typescript
if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "d") {
  e.preventDefault();
  useUIStore.getState().addDiagramTab();
}
```

Search for where `Cmd+K` is handled to find the right location to add this.

**Step 4: Verify build**

```bash
bun run build
```

Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/components/ui/CommandPalette.tsx src/components/layout/Sidebar.tsx src/components/layout/AppLayout.tsx
git commit -m "feat: add diagram access points — command palette, sidebar, keyboard shortcut"
```

---

### Task 12: Dark Theme Styling Pass and React Flow CSS Overrides

**Files:**
- Modify: `src/index.css` (or create `src/components/diagram/diagram.css`)

**Step 1: Add React Flow dark theme overrides**

React Flow comes with its own CSS. We need to override some styles to match Tusker's dark theme. Add to `src/index.css` (or a new CSS file imported in DiagramTab):

```css
/* React Flow dark theme overrides */
.react-flow {
  --xy-background-color: var(--bg-primary);
  --xy-node-border-radius: 8px;
}

.react-flow__minimap {
  border-radius: 8px;
}

.react-flow__controls {
  border-radius: 8px;
}

.react-flow__controls button {
  border-radius: 4px;
}

.react-flow__controls button:hover {
  background-color: var(--bg-tertiary);
}

/* Hide default React Flow attribution */
.react-flow__attribution {
  display: none;
}

/* Smooth edge animations */
.react-flow__edge-path {
  transition: stroke 0.15s, stroke-width 0.15s;
}

/* Node cursor */
.react-flow__node {
  cursor: pointer;
}

/* Minimap dark colors */
.react-flow__minimap-mask {
  fill: rgba(0, 0, 0, 0.6);
}
```

**Step 2: Verify build**

```bash
bun run build
```

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: add React Flow dark theme CSS overrides for schema diagram"
```

---

### Task 13: Final Integration Testing and Polish

**Files:**
- Potentially all diagram files for bug fixes

**Step 1: Test the full flow**

Run the app:
```bash
bun run tauri dev
```

Test checklist:
1. Connect to a database with multiple schemas and tables
2. Open diagram via Command Palette (`Cmd+K` → "Open Schema Diagram")
3. Open diagram via sidebar right-click → "Schema Diagram"
4. Open diagram via `Cmd+Shift+D`
5. Verify: tables render as nodes with full column detail
6. Verify: FK relationships shown as edges with arrows
7. Verify: hover on a node highlights connected nodes/edges
8. Verify: click on a node opens table data in new tab
9. Verify: search filters nodes
10. Verify: schema dropdown filters schemas
11. Verify: "Reset Layout" button re-runs dagre
12. Verify: "Fit View" zooms to fit
13. Verify: "Export PNG" downloads an image
14. Verify: MiniMap works (pan + zoom in minimap)
15. Verify: drag nodes to reposition
16. Verify: only one diagram tab can be open at a time (singleton)

**Step 2: Fix any issues found**

Common issues to watch for:
- Handle positions not aligning with column rows (adjust `style={{ top: "50%" }}` on handles)
- Edges not connecting properly (check handle IDs match between `buildEdges()` and `TableNode`)
- React Flow CSS conflicts with Tailwind
- `html-to-image` export capturing incorrect area

**Step 3: Final commit if any fixes were made**

```bash
git add -A
git commit -m "fix: polish schema diagram integration and fix edge cases"
```
