import { useCallback } from "react";
import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { TableNodeData } from "./diagramUtils";

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

      for (const node of nodes) {
        const { width, height } = getNodeDimensions(node);
        g.setNode(node.id, { width, height });
      }

      for (const edge of edges) {
        g.setEdge(edge.source, edge.target);
      }

      // Add same-schema clustering edges for dagre layout
      const tablesBySchema = new Map<string, string[]>();
      for (const node of nodes) {
        const data = node.data as TableNodeData;
        if (!tablesBySchema.has(data.schema)) {
          tablesBySchema.set(data.schema, []);
        }
        tablesBySchema.get(data.schema)!.push(node.id);
      }

      for (const [, tableIds] of tablesBySchema) {
        for (let i = 0; i < tableIds.length - 1; i++) {
          g.setEdge(tableIds[i], tableIds[i + 1], { weight: 0.1 });
        }
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
