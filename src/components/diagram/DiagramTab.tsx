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
  getNodesBounds,
  getViewportForBounds,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { Database, Loader2 } from "lucide-react";
import { toPng, toSvg } from "html-to-image";
import { useProjectStore } from "../../stores/projectStore";
import { useUIStore } from "../../stores/uiStore";
import { getCurrentConnectionId } from "../../hooks/useDatabase";
import { TableNode } from "./TableNode";
import { SchemaLabelNode } from "./SchemaLabelNode";
import { SchemaEdge } from "./SchemaEdge";
import { DiagramToolbar, type ExportFormat } from "./DiagramToolbar";
import { useAutoLayout } from "./useAutoLayout";
import {
  buildNodes,
  buildEdges,
  getSchemaColorMap,
  type DiagramColumn,
  type TableNodeData,
} from "./diagramUtils";

const nodeTypes = { tableNode: TableNode, schemaLabel: SchemaLabelNode };
const edgeTypes = { schemaEdge: SchemaEdge };

interface TableColumnsResult {
  schema: string;
  table: string;
  columns: Array<{
    name: string;
    data_type: string;
    is_primary_key: boolean;
    is_foreign_key: boolean;
    is_nullable: boolean;
    is_unique: boolean;
    foreign_key_info: {
      constraint_name: string;
      referenced_schema: string;
      referenced_table: string;
      referenced_column: string;
    } | null;
    enum_values: string[] | null;
  }>;
}

interface DiagramCanvasProps {
  schema?: string;
}

function DiagramCanvas({ schema: singleSchema }: DiagramCanvasProps) {
  const allSchemas = useProjectStore((s) => s.schemas);
  const schemas = useMemo(
    () => singleSchema ? allSchemas.filter((s) => s.name === singleSchema) : allSchemas,
    [allSchemas, singleSchema],
  );
  const addTab = useUIStore((s) => s.addTab);
  const { fitView, getNodes } = useReactFlow();
  const { getLayoutedElements } = useAutoLayout();

  const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Sync dragged positions back to allNodesRef so the filter effect doesn't reset them
  const onNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChangeBase>[0]) => {
      onNodesChangeBase(changes);
      for (const change of changes) {
        if (change.type === "position" && change.position) {
          const ref = allNodesRef.current.find((n) => n.id === change.id);
          if (ref) {
            ref.position = change.position;
          }
        }
      }
    },
    [onNodesChangeBase],
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [visibleSchemas, setVisibleSchemas] = useState<Set<string>>(new Set());
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const allNodesRef = useRef<Node[]>([]);
  const allEdgesRef = useRef<Edge[]>([]);
  const loadedRef = useRef(false);
  const loadingInProgressRef = useRef(false);

  const schemaNames = useMemo(() => schemas.map((s) => s.name), [schemas]);

  useEffect(() => {
    setVisibleSchemas(new Set(schemaNames));
  }, [schemaNames]);

  // Fetch all column data in a single query and build diagram
  useEffect(() => {
    if (loadedRef.current || loadingInProgressRef.current) return;

    const connectionId = getCurrentConnectionId();
    if (!connectionId || schemas.length === 0) {
      setLoading(false);
      return;
    }

    loadingInProgressRef.current = true;

    async function loadDiagram() {
      try {
        const currentSchemas = schemas;
        const currentSchemaNames = currentSchemas.map((s) => s.name);

        // Single IPC call fetches all columns for all tables across all schemas
        const allTableColumns = await invoke<TableColumnsResult[]>("get_all_columns", {
          connectionId,
          schemas: currentSchemaNames,
        });

        const columnsMap = new Map<string, DiagramColumn[]>();
        for (const tc of allTableColumns) {
          const key = `${tc.schema}.${tc.table}`;
          columnsMap.set(key, tc.columns.map((c) => ({
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
          })));
        }

        const schemaColorMap = getSchemaColorMap(currentSchemaNames);
        const builtNodes = buildNodes(currentSchemas, columnsMap, schemaColorMap);
        const builtEdges = buildEdges(builtNodes);

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
          builtNodes,
          builtEdges,
          schemaColorMap,
        );

        loadedRef.current = true;
        allNodesRef.current = layoutedNodes;
        allEdgesRef.current = layoutedEdges;

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
        setLoading(false);

        setTimeout(() => fitView({ padding: 0.1 }), 100);
      } catch (err) {
        console.error("Failed to load diagram:", err);
        setError(String(err));
        setLoading(false);
      } finally {
        loadingInProgressRef.current = false;
      }
    }

    loadDiagram();
  }); // No deps — runs every render but bails early via refs

  // Apply search and schema filters (rebuilds node list — only on filter changes, NOT hover)
  useEffect(() => {
    if (loading) return;

    const lowerSearch = searchQuery.toLowerCase();

    const filteredNodes = allNodesRef.current.filter((node) => {
      if (node.type === "schemaLabel") {
        const schemaName = (node.data as { label: string }).label;
        if (!visibleSchemas.has(schemaName)) return false;
        if (lowerSearch) return false;
        return true;
      }
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

    setNodes(filteredNodes.map((n) => ({ ...n, style: { ...n.style, opacity: 1, transition: "opacity 0.2s" } })));
    setEdges(filteredEdges.map((e) => ({ ...e, style: { ...e.style, opacity: undefined } })));
  }, [searchQuery, visibleSchemas, loading, setNodes, setEdges]);

  // Hover highlighting — updates styles in-place without replacing node objects
  useEffect(() => {
    if (loading) return;

    setNodes((currentNodes) => {
      // Compute connected set from current edges
      const connectedNodeIds = new Set<string>();
      if (hoveredNodeId) {
        for (const e of allEdgesRef.current) {
          if (e.source === hoveredNodeId) connectedNodeIds.add(e.target);
          if (e.target === hoveredNodeId) connectedNodeIds.add(e.source);
        }
      }

      return currentNodes.map((node) => {
        if (node.type === "schemaLabel") return node;
        if (!hoveredNodeId) {
          return node.style?.opacity === 1 ? node : { ...node, style: { ...node.style, opacity: 1, transition: "opacity 0.2s" } };
        }
        const isHighlighted = node.id === hoveredNodeId || connectedNodeIds.has(node.id);
        const targetOpacity = isHighlighted ? 1 : 0.25;
        return node.style?.opacity === targetOpacity ? node : { ...node, style: { ...node.style, opacity: targetOpacity, transition: "opacity 0.2s" } };
      });
    });

    setEdges((currentEdges) => {
      if (!hoveredNodeId) {
        return currentEdges.map((e) =>
          e.style?.opacity === undefined ? e : { ...e, style: { ...e.style, opacity: undefined } },
        );
      }
      return currentEdges.map((e) => {
        const isConnected = e.source === hoveredNodeId || e.target === hoveredNodeId;
        const targetOpacity = isConnected ? 1 : 0.1;
        return e.style?.opacity === targetOpacity ? e : { ...e, style: { ...e.style, opacity: targetOpacity } };
      });
    });
  }, [hoveredNodeId, loading, setNodes, setEdges]);

  const handleNodeMouseEnter: NodeMouseHandler = useCallback((_event, node) => {
    if (node.type === "schemaLabel") return;
    setHoveredNodeId(node.id);
  }, []);

  const handleNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.type === "schemaLabel") return;
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

  const schemaColorMap = useMemo(() => getSchemaColorMap(schemaNames), [schemaNames]);

  const handleResetLayout = useCallback(() => {
    // Filter out schema label nodes — layout regenerates them
    const tableNodes = allNodesRef.current.filter(
      (n) => n.type === "tableNode",
    ) as Node<TableNodeData>[];
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      tableNodes,
      allEdgesRef.current,
      schemaColorMap,
    );
    allNodesRef.current = layoutedNodes;
    allEdgesRef.current = layoutedEdges;
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    setTimeout(() => fitView({ padding: 0.1 }), 50);
  }, [getLayoutedElements, setNodes, setEdges, fitView, schemaColorMap]);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.1, duration: 300 });
  }, [fitView]);

  const handleExport = useCallback(async (format: ExportFormat) => {
    try {
      const viewport = containerRef.current?.querySelector(".react-flow__viewport") as HTMLElement;
      if (!viewport) return;

      const currentNodes = getNodes();
      if (currentNodes.length === 0) return;

      const bounds = getNodesBounds(currentNodes);
      const padding = 40;
      const imageWidth = Math.max(1024, bounds.width + padding * 2);
      const imageHeight = Math.max(768, bounds.height + padding * 2);

      const { x, y, zoom } = getViewportForBounds(
        bounds,
        imageWidth,
        imageHeight,
        0.5,
        2,
        0.1,
      );

      const bgColor =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--bg-primary")
          .trim() || "#1a1a2e";

      const commonOptions = {
        backgroundColor: bgColor,
        width: imageWidth,
        height: imageHeight,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${x}px, ${y}px) scale(${zoom})`,
        },
      };

      if (format === "svg") {
        const dataUrl = await toSvg(viewport, commonOptions);

        const filePath = await save({
          defaultPath: "schema-diagram.svg",
          filters: [{ name: "SVG Image", extensions: ["svg"] }],
        });
        if (!filePath) return;

        const svgContent = decodeURIComponent(dataUrl.split(",")[1]);
        await writeFile(filePath, new TextEncoder().encode(svgContent));
      } else {
        // 2x resolution for crisp PNG
        const scale = 2;
        const dataUrl = await toPng(viewport, {
          ...commonOptions,
          width: imageWidth * scale,
          height: imageHeight * scale,
          pixelRatio: scale,
        });

        const filePath = await save({
          defaultPath: "schema-diagram.png",
          filters: [{ name: "PNG Image", extensions: ["png"] }],
        });
        if (!filePath) return;

        const base64 = dataUrl.split(",")[1];
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        await writeFile(filePath, bytes);
      }
    } catch (err) {
      console.error("Failed to export diagram:", err);
    }
  }, [getNodes]);

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
      <div className="h-full flex flex-col items-center justify-center gap-5">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center">
            <Database className="w-7 h-7 text-[var(--accent)]" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[var(--bg-primary)] flex items-center justify-center border border-[var(--border-color)]">
            <Loader2 className="w-3.5 h-3.5 text-[var(--accent)] animate-spin" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">
            Building schema diagram
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            Loading table metadata...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <Database className="w-6 h-6 text-red-400" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-medium text-[var(--text-primary)]">Failed to load diagram</span>
          <span className="text-xs text-[var(--text-muted)] max-w-md text-center">{error}</span>
        </div>
      </div>
    );
  }

  if (allNodesRef.current.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center">
          <Database className="w-6 h-6 text-[var(--text-muted)]" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-medium text-[var(--text-primary)]">No tables found</span>
          <span className="text-xs text-[var(--text-muted)]">This database has no tables to visualize.</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 flex flex-col h-full">
      <DiagramToolbar
        schemaNames={schemaNames}
        visibleSchemas={visibleSchemas}
        onToggleSchema={handleToggleSchema}
        onShowAllSchemas={handleShowAllSchemas}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onResetLayout={handleResetLayout}
        onFitView={handleFitView}
        onExport={handleExport}
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
              if (node.type === "schemaLabel") return "transparent";
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

export function DiagramTab({ schema }: { schema?: string }) {
  return (
    <ReactFlowProvider>
      <DiagramCanvas schema={schema} />
    </ReactFlowProvider>
  );
}
