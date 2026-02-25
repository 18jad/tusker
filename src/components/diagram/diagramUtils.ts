import type { Node, Edge, MarkerType } from "@xyflow/react";

// Schema color palette — each schema gets a consistent color
const SCHEMA_COLORS = [
  { bg: "rgba(59, 130, 246, 0.15)", border: "#3b82f6", text: "#60a5fa", accent: "#3b82f6" },
  { bg: "rgba(16, 185, 129, 0.15)", border: "#10b981", text: "#34d399", accent: "#10b981" },
  { bg: "rgba(245, 158, 11, 0.15)", border: "#f59e0b", text: "#fbbf24", accent: "#f59e0b" },
  { bg: "rgba(168, 85, 247, 0.15)", border: "#a855f7", text: "#c084fc", accent: "#a855f7" },
  { bg: "rgba(239, 68, 68, 0.15)", border: "#ef4444", text: "#f87171", accent: "#ef4444" },
  { bg: "rgba(236, 72, 153, 0.15)", border: "#ec4899", text: "#f472b6", accent: "#ec4899" },
  { bg: "rgba(20, 184, 166, 0.15)", border: "#14b8a6", text: "#2dd4bf", accent: "#14b8a6" },
  { bg: "rgba(249, 115, 22, 0.15)", border: "#f97316", text: "#fb923c", accent: "#f97316" },
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

export function formatRowCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
}

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
        position: { x: 0, y: 0 },
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
