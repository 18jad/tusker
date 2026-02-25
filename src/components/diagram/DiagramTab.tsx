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
import { Loader2 } from "lucide-react";
import { toPng } from "html-to-image";
import { useProjectStore } from "../../stores/projectStore";
import { useUIStore } from "../../stores/uiStore";
import { getCurrentConnectionId, type FullColumnInfo } from "../../hooks/useDatabase";
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
  const { fitView } = useReactFlow();
  const { getLayoutedElements } = useAutoLayout();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState({ loaded: 0, total: 0 });

  const [searchQuery, setSearchQuery] = useState("");
  const [visibleSchemas, setVisibleSchemas] = useState<Set<string>>(new Set());
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const allNodesRef = useRef<Node<TableNodeData>[]>([]);
  const allEdgesRef = useRef<Edge[]>([]);

  const schemaNames = useMemo(() => schemas.map((s) => s.name), [schemas]);

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
      setLoading(true);
      const allTables: { schema: string; table: string }[] = [];
      for (const schema of schemas) {
        for (const table of schema.tables) {
          allTables.push({ schema: schema.name, table: table.name });
        }
      }

      setLoadProgress({ loaded: 0, total: allTables.length });

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

      setTimeout(() => fitView({ padding: 0.1 }), 100);
    }

    loadDiagram();
    return () => { cancelled = true; };
  }, [schemas, schemaNames, getLayoutedElements, setNodes, setEdges, fitView]);

  // Apply search, schema filters, and hover highlighting
  useEffect(() => {
    if (loading) return;

    const lowerSearch = searchQuery.toLowerCase();

    const filteredNodes = allNodesRef.current.filter((node) => {
      const data = node.data as TableNodeData;
      if (!visibleSchemas.has(data.schema)) return false;
      if (lowerSearch && !`${data.schema}.${data.table}`.toLowerCase().includes(lowerSearch)) {
        return false;
      }
      return true;
    });

    const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));

    const filteredEdges = allEdgesRef.current.filter(
      (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target),
    );

    // Pre-compute connected nodes for hover highlighting
    const connectedNodeIds = new Set<string>();
    if (hoveredNodeId) {
      for (const e of filteredEdges) {
        if (e.source === hoveredNodeId) connectedNodeIds.add(e.target);
        if (e.target === hoveredNodeId) connectedNodeIds.add(e.source);
      }
    }

    const styledNodes = filteredNodes.map((node) => {
      if (!hoveredNodeId) return { ...node, style: { ...node.style, opacity: 1, transition: "opacity 0.2s" } };
      const isHovered = node.id === hoveredNodeId;
      const isConnected = connectedNodeIds.has(node.id);
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
      if (!hoveredNodeId) return { ...edge, style: { ...edge.style, opacity: undefined } };
      const isConnected = edge.source === hoveredNodeId || edge.target === hoveredNodeId;
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
      const flowElement = document.querySelector(".react-flow") as HTMLElement;
      if (!flowElement) return;

      const dataUrl = await toPng(flowElement, {
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || "#1a1a2e",
        quality: 1,
      });

      const link = document.createElement("a");
      link.download = "schema-diagram.png";
      link.href = dataUrl;
      link.click();
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
            nodeColor={(node) => {
              const data = node.data as TableNodeData;
              return data?.schemaColor?.accent ?? "#6b7280";
            }}
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
