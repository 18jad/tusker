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
} from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useUIStore } from "../../stores/uiStore";
import { cn, generateId, PROJECT_COLORS } from "../../lib/utils";
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
}: TreeItemProps) {
  const hasChildren = !!children;
  const paddingLeft = 12 + level * 16;

  return (
    <div>
      <button
        onClick={hasChildren ? onToggle : onClick}
        className={cn(
          "w-full flex items-center gap-2 h-7 text-sm",
          "hover:bg-[var(--bg-tertiary)] transition-colors duration-150",
          isActive && "bg-[var(--bg-tertiary)] text-[var(--accent)]"
        )}
        style={{ paddingLeft }}
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
  const [isExpanded, setIsExpanded] = useState(false);
  const addTab = useUIStore((state) => state.addTab);
  const activeTabId = useUIStore((state) => state.activeTabId);
  const tabs = useUIStore((state) => state.tabs);

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
      onToggle={() => setIsExpanded(!isExpanded)}
    >
      {schema.tables.map((table) => (
        <TreeItem
          key={`${schema.name}.${table.name}`}
          label={table.name}
          icon={<Table2 className="w-4 h-4 text-[var(--accent)]" />}
          level={level + 1}
          onClick={() => handleTableClick(table)}
          isActive={isTableActive(table.name)}
        />
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

          {/* Footer - New Project button */}
          <div className="p-2 border-t border-[var(--border-color)] shrink-0">
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
