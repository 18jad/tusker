import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Database,
  Table2,
  FolderClosed,
  FolderOpen,
  Plus,
  PanelLeftClose,
  PanelLeft,
  Trash2,
  Copy,
  Code,
  RefreshCw,
  Eraser,
  Download,
  Upload,
  FileSpreadsheet,
  FileJson,
  Terminal,
  Settings,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useProjectStore } from "../../stores/projectStore";
import { useUIStore } from "../../stores/uiStore";
import { cn, generateId, PROJECT_COLORS, modKey } from "../../lib/utils";
import { exportTable } from "../../lib/exportTable";
import { ContextMenu } from "../ui";
import type { Schema, Table } from "../../types";

interface TreeItemProps {
  label: string;
  icon: React.ReactNode;
  level: number;
  isExpanded?: boolean;
  onToggle?: () => void;
  onClick?: () => void;
  children?: React.ReactNode;
  isActive?: boolean;
  action?: React.ReactNode;
}

function TreeItem({
  label,
  icon,
  level,
  isExpanded,
  onToggle,
  onClick,
  children,
  isActive,
  action,
}: TreeItemProps) {
  const hasChildren = !!children;
  const paddingLeft = 12 + level * 16;

  return (
    <div className="group/tree-item select-none">
      <div
        className={cn(
          "w-full flex items-center gap-2 h-7 text-sm",
          "hover:bg-[var(--bg-tertiary)] transition-colors duration-150",
          isActive && "bg-[var(--bg-tertiary)] text-[var(--accent)]"
        )}
        style={{ paddingLeft }}
      >
        <button
          onClick={hasChildren ? onToggle : onClick}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          {hasChildren ? (
            <span className="w-4 h-4 flex items-center justify-center shrink-0">
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              )}
            </span>
          ) : (
            <span className="w-4 h-4 shrink-0" />
          )}
          <span className="shrink-0">{icon}</span>
          <span className="truncate text-left">{label}</span>
        </button>
        {action && (
          <span className="opacity-0 group-hover/tree-item:opacity-100 transition-opacity duration-150 pr-2">
            {action}
          </span>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div className="overflow-hidden transition-all duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

interface SchemaTreeProps {
  schema: Schema;
  level: number;
}

function SchemaTree({ schema, level }: SchemaTreeProps) {
  const queryClient = useQueryClient();
  const addTab = useUIStore((state) => state.addTab);
  const activeTabId = useUIStore((state) => state.activeTabId);
  const tabs = useUIStore((state) => state.tabs);
  const addCreateTableTab = useUIStore((state) => state.addCreateTableTab);
  const addEditTableTab = useUIStore((state) => state.addEditTableTab);
  const openDeleteTableModal = useUIStore((state) => state.openDeleteTableModal);
  const openTruncateTableModal = useUIStore((state) => state.openTruncateTableModal);
  const addImportDataTab = useUIStore((state) => state.addImportDataTab);
  const showToast = useUIStore((state) => state.showToast);
  const isExpanded = useUIStore((state) => state.expandedSchemas.has(schema.name));
  const toggleSchemaExpanded = useUIStore((state) => state.toggleSchemaExpanded);

  const handleTableClick = (table: Table) => {
    addTab({
      id: generateId(),
      type: "table",
      title: table.name,
      schema: table.schema,
      table: table.name,
    });
  };

  const isTableActive = (tableName: string) => {
    if (!activeTabId) return false;
    const activeTab = tabs.find((t) => t.id === activeTabId);
    return (
      activeTab?.type === "table" &&
      activeTab.table === tableName &&
      activeTab.schema === schema.name
    );
  };

  const handleCreateTable = (e: React.MouseEvent) => {
    e.stopPropagation();
    addCreateTableTab(schema.name);
  };

  return (
    <TreeItem
      label={schema.name}
      icon={
        isExpanded ? (
          <FolderOpen className="w-4 h-4 text-[var(--warning)]" />
        ) : (
          <FolderClosed className="w-4 h-4 text-[var(--warning)]" />
        )
      }
      level={level}
      isExpanded={isExpanded}
      onToggle={() => toggleSchemaExpanded(schema.name)}
      action={
        <button
          onClick={handleCreateTable}
          className={cn(
            "p-0.5 rounded hover:bg-[var(--bg-tertiary)]",
            "text-[var(--text-muted)] hover:text-purple-400",
            "transition-colors duration-150"
          )}
          title={`Create table in ${schema.name}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      }
    >
      {schema.tables.map((table) => (
        <ContextMenu
          key={`${schema.name}.${table.name}`}
          items={[
            {
              label: "Copy Name",
              icon: <Copy className="w-4 h-4" />,
              onClick: () => {
                navigator.clipboard.writeText(`${schema.name}.${table.name}`);
              },
            },
            {
              label: "Copy SELECT",
              icon: <Code className="w-4 h-4" />,
              onClick: () => {
                navigator.clipboard.writeText(`SELECT * FROM "${schema.name}"."${table.name}"`);
              },
            },
            {
              label: "Refresh",
              icon: <RefreshCw className="w-4 h-4" />,
              onClick: () => {
                queryClient.invalidateQueries({
                  queryKey: ["tableData", schema.name, table.name],
                });
              },
            },
            {
              type: "separator" as const,
            },
            {
              type: "submenu" as const,
              label: "Export",
              icon: <Download className="w-4 h-4" />,
              items: [
                {
                  label: "Export as CSV",
                  icon: <FileSpreadsheet className="w-4 h-4" />,
                  onClick: () => {
                    exportTable(
                      schema.name,
                      table.name,
                      "csv",
                      (message) => showToast(message),
                      (message) => showToast(message, "error")
                    );
                  },
                },
                {
                  label: "Export as JSON",
                  icon: <FileJson className="w-4 h-4" />,
                  onClick: () => {
                    exportTable(
                      schema.name,
                      table.name,
                      "json",
                      (message) => showToast(message),
                      (message) => showToast(message, "error")
                    );
                  },
                },
              ],
            },
            {
              type: "submenu" as const,
              label: "Import",
              icon: <Upload className="w-4 h-4" />,
              items: [
                {
                  label: "Import from CSV",
                  icon: <FileSpreadsheet className="w-4 h-4" />,
                  onClick: () => {
                    addImportDataTab(schema.name, table.name, "csv");
                  },
                },
                {
                  label: "Import from JSON",
                  icon: <FileJson className="w-4 h-4" />,
                  onClick: () => {
                    addImportDataTab(schema.name, table.name, "json");
                  },
                },
              ],
            },
            {
              type: "separator" as const,
            },
            {
              label: "Edit Table",
              icon: <Settings className="w-4 h-4" />,
              onClick: () => addEditTableTab(schema.name, table.name),
            },
            {
              type: "separator" as const,
            },
            {
              label: "Truncate Table",
              icon: <Eraser className="w-4 h-4" />,
              variant: "danger",
              onClick: () => openTruncateTableModal(schema.name, table.name, table.rowCount),
            },
            {
              label: "Delete Table",
              icon: <Trash2 className="w-4 h-4" />,
              variant: "danger",
              onClick: () => openDeleteTableModal(schema.name, table.name, table.rowCount),
            },
          ]}
        >
          <TreeItem
            label={table.name}
            icon={<Table2 className="w-4 h-4 text-[var(--accent)]" />}
            level={level + 1}
            onClick={() => handleTableClick(table)}
            isActive={isTableActive(table.name)}
          />
        </ContextMenu>
      ))}
      {schema.tables.length === 0 && (
        <div
          className="text-xs text-[var(--text-muted)] py-1"
          style={{ paddingLeft: 12 + (level + 1) * 16 }}
        >
          No tables
        </div>
      )}
    </TreeItem>
  );
}

function ProjectTree() {
  const activeProject = useProjectStore((state) => state.getActiveProject());
  const schemas = useProjectStore((state) => state.schemas);
  const connectionStatus = useProjectStore((state) => state.connectionStatus);
  const schemasLoading = useProjectStore((state) => state.schemasLoading);
  const [isExpanded, setIsExpanded] = useState(true);

  if (!activeProject) {
    return (
      <div className="p-4 text-center text-[var(--text-muted)] text-sm">
        No project selected
      </div>
    );
  }

  const colorConfig = PROJECT_COLORS[activeProject.color];

  return (
    <div className="py-2">
      <TreeItem
        label={activeProject.name}
        icon={
          <Database className={cn("w-4 h-4", colorConfig.text)} />
        }
        level={0}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
      >
        {connectionStatus === "connecting" ? (
          <div className="text-xs text-[var(--text-muted)] py-1 pl-12">
            Connecting...
          </div>
        ) : connectionStatus === "connected" ? (
          schemasLoading ? (
            <div className="text-xs text-[var(--text-muted)] py-1 pl-12">
              Loading schemas...
            </div>
          ) : schemas.length > 0 ? (
            schemas.map((schema) => (
              <SchemaTree key={schema.name} schema={schema} level={1} />
            ))
          ) : (
            <div className="text-xs text-[var(--text-muted)] py-1 pl-12">
              No schemas found
            </div>
          )
        ) : (
          <div className="text-xs text-[var(--text-muted)] py-1 pl-12">
            Not connected
          </div>
        )}
      </TreeItem>
    </div>
  );
}

interface SidebarProps {
  isCollapsed: boolean;
  width: number;
  onToggle: () => void;
  onWidthChange: (width: number) => void;
}

export function Sidebar({
  isCollapsed,
  width,
  onToggle,
  onWidthChange,
}: SidebarProps) {
  const openProjectModal = useUIStore((state) => state.openProjectModal);
  const addCreateTableTab = useUIStore((state) => state.addCreateTableTab);
  const addQueryTab = useUIStore((state) => state.addQueryTab);
  const connectionStatus = useProjectStore((state) => state.connectionStatus);

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-[var(--bg-secondary)]",
        "border-r border-[var(--border-color)]",
        "transition-[width] duration-200 ease-out",
        "relative shrink-0"
      )}
      style={{ width: isCollapsed ? 48 : width }}
    >
      {/* Header */}
      <div
        className={cn(
          "h-10 flex items-center shrink-0",
          "border-b border-[var(--border-color)]",
          isCollapsed ? "justify-center" : "justify-between px-3"
        )}
      >
        {!isCollapsed && (
          <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
            Explorer
          </span>
        )}
        <button
          onClick={onToggle}
          className={cn(
            "p-1.5 rounded hover:bg-[var(--bg-tertiary)]",
            "transition-colors duration-150",
            "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          )}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <PanelLeft className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <>
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <ProjectTree />
          </div>

          {/* Footer buttons */}
          <div className="p-2 border-t border-[var(--border-color)] shrink-0 flex flex-col gap-2">
            {connectionStatus === "connected" && (
              <>
                <button
                  onClick={() => addQueryTab()}
                  className={cn(
                    "w-full flex items-center gap-2 h-8 px-3",
                    "bg-green-600/20 hover:bg-green-600/30",
                    "rounded text-sm text-green-400",
                    "hover:text-green-300",
                    "transition-colors duration-150"
                  )}
                >
                  <Terminal className="w-4 h-4" />
                  <span>New Query</span>
                  <div className="flex items-center gap-0.5 ml-auto">
                    <kbd className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-500/20 text-green-300/80">{modKey.replace('+', '')}</kbd>
                    <kbd className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-500/20 text-green-300/80">T</kbd>
                  </div>
                </button>
                <button
                  onClick={() => addCreateTableTab()}
                  className={cn(
                    "w-full flex items-center gap-2 h-8 px-3",
                    "bg-purple-600/20 hover:bg-purple-600/30",
                    "rounded text-sm text-purple-400",
                    "hover:text-purple-300",
                    "transition-colors duration-150"
                  )}
                >
                  <Table2 className="w-4 h-4" />
                  <span>New Table</span>
                  <div className="flex items-center gap-0.5 ml-auto">
                    <kbd className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-500/20 text-purple-300/80">{modKey.replace('+', '')}</kbd>
                    <kbd className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-500/20 text-purple-300/80">N</kbd>
                  </div>
                </button>
              </>
            )}
            <button
              onClick={() => openProjectModal()}
              className={cn(
                "w-full flex items-center justify-center gap-2 h-8",
                "bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)]",
                "rounded text-sm text-[var(--text-secondary)]",
                "hover:text-[var(--text-primary)]",
                "transition-colors duration-150"
              )}
            >
              <Plus className="w-4 h-4" />
              <span>New Project</span>
            </button>
          </div>
        </>
      )}

      {/* Resize handle */}
      {!isCollapsed && (
        <ResizeHandle width={width} onWidthChange={onWidthChange} />
      )}
    </aside>
  );
}

interface ResizeHandleProps {
  width: number;
  onWidthChange: (width: number) => void;
}

function ResizeHandle({ width, onWidthChange }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(180, Math.min(400, startWidth + delta));
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      className={cn(
        "absolute top-0 right-0 w-1 h-full cursor-col-resize",
        "hover:bg-[var(--accent)] transition-colors duration-150",
        isDragging && "bg-[var(--accent)]"
      )}
    />
  );
}
