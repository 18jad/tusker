import { useCallback } from "react";
import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { TableNodeData } from "./diagramUtils";
import type { SchemaLabelNodeData } from "./SchemaLabelNode";

const NODE_WIDTH = 280;
const HEADER_HEIGHT = 40;
const COLUMN_HEIGHT = 28;
const NODE_PADDING = 8;

/** Gap between schema sections */
const SCHEMA_GAP = 120;
/** Space above tables for the schema label */
const LABEL_OFFSET_Y = 50;

function getNodeDimensions(node: Node<TableNodeData>): { width: number; height: number } {
  const columnCount = node.data.columns.length;
  return {
    width: NODE_WIDTH,
    height: HEADER_HEIGHT + columnCount * COLUMN_HEIGHT + NODE_PADDING,
  };
}

/** Run dagre layout on a subset of nodes/edges, returns positioned nodes */
function layoutSchemaGroup(
  nodes: Node<TableNodeData>[],
  edges: Edge[],
): Node<TableNodeData>[] {
  if (nodes.length === 0) return [];

  try {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({
      rankdir: "LR",
      nodesep: 60,
      ranksep: 180,
      marginx: 30,
      marginy: 30,
    });

    for (const node of nodes) {
      const { width, height } = getNodeDimensions(node);
      g.setNode(node.id, { width, height });
    }

    for (const edge of edges) {
      g.setEdge(edge.source, edge.target);
    }

    dagre.layout(g);

    return nodes.map((node) => {
      const pos = g.node(node.id);
      const { width, height } = getNodeDimensions(node);
      return {
        ...node,
        position: {
          x: pos.x - width / 2,
          y: pos.y - height / 2,
        },
      };
    });
  } catch {
    // Dagre can fail on certain graph structures — fall back to grid
    const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
    return nodes.map((node, i) => ({
      ...node,
      position: {
        x: (i % cols) * 320,
        y: Math.floor(i / cols) * 400,
      },
    }));
  }
}

/** Get bounding box of a set of positioned nodes */
function getBBox(nodes: Node<TableNodeData>[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes) {
    const { width, height } = getNodeDimensions(node);
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + width);
    maxY = Math.max(maxY, node.position.y + height);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function useAutoLayout() {
  const getLayoutedElements = useCallback(
    (
      nodes: Node<TableNodeData>[],
      edges: Edge[],
      schemaColorMap?: Record<string, { accent: string }>,
    ) => {
      if (nodes.length === 0) return { nodes: [] as Node[], edges };

      // Group nodes by schema
      const schemaGroups = new Map<string, Node<TableNodeData>[]>();
      for (const node of nodes) {
        const schema = (node.data as TableNodeData).schema;
        if (!schemaGroups.has(schema)) {
          schemaGroups.set(schema, []);
        }
        schemaGroups.get(schema)!.push(node);
      }

      // Build a set of node IDs per schema for edge filtering
      const nodeSchemaMap = new Map<string, string>();
      for (const node of nodes) {
        nodeSchemaMap.set(node.id, (node.data as TableNodeData).schema);
      }

      // Layout each schema group independently using only intra-schema edges
      const allLayoutedNodes: Node[] = [];
      let currentY = 0;

      const schemaEntries = Array.from(schemaGroups.entries());

      for (const [schemaName, schemaNodes] of schemaEntries) {
        // Filter edges to only those within this schema
        const schemaNodeIds = new Set(schemaNodes.map((n) => n.id));
        const intraEdges = edges.filter(
          (e) => schemaNodeIds.has(e.source) && schemaNodeIds.has(e.target),
        );

        // Layout this schema's tables
        const layouted = layoutSchemaGroup(schemaNodes, intraEdges);

        if (layouted.length === 0) continue;

        // Get bounding box and normalize to origin
        const bbox = getBBox(layouted);

        // Shift all nodes so the group starts at (0, currentY + LABEL_OFFSET_Y)
        const offsetX = -bbox.minX;
        const offsetY = currentY + LABEL_OFFSET_Y - bbox.minY;

        for (const node of layouted) {
          node.position.x += offsetX;
          node.position.y += offsetY;
        }

        // Add schema label node above the group
        const color = schemaColorMap?.[schemaName]?.accent ?? "#6b7280";
        const labelNode: Node<SchemaLabelNodeData> = {
          id: `__schema-label-${schemaName}`,
          type: "schemaLabel",
          position: { x: 0, y: currentY },
          data: {
            label: schemaName,
            color,
            tableCount: schemaNodes.length,
          },
          selectable: false,
          draggable: false,
        };

        allLayoutedNodes.push(labelNode);
        allLayoutedNodes.push(...layouted);

        // Move Y cursor past this group
        const finalBBox = getBBox(layouted);
        currentY = finalBBox.maxY + SCHEMA_GAP;
      }

      return { nodes: allLayoutedNodes, edges };
    },
    [],
  );

  return { getLayoutedElements };
}
