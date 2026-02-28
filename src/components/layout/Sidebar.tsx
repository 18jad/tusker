import { useState, useRef, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  Database,
  Table2,
  FolderClosed,
  FolderOpen,
  FolderPlus,
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
  Plug,
  Unplug,
  ArrowLeftRight,
  Info,
  Pencil,
  Workflow,
  MoreHorizontal,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useProjectStore } from "../../stores/projectStore";
import { useUIStore } from "../../stores/uiStore";

import { cn, generateId, PROJECT_COLORS } from "../../lib/utils";
import { exportTable } from "../../lib/exportTable";
import { ContextMenu } from "../ui";
import { useConnect, useDisconnect, useExecuteSQL } from "../../hooks/useDatabase";
import type { Schema, Table, Project, ProjectColor } from "../../types";

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
  menuOpen?: boolean;
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
  menuOpen,
}: TreeItemProps) {
  const hasChildren = !!children;
  const paddingLeft = 12 + level * 16;

  return (
    <div className="select-none">
      <div
        className={cn(
          "group/tree-item w-full flex items-center gap-2 h-7 text-sm",
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
          <span className={cn(
            "transition-opacity duration-150 pr-2",
            menuOpen ? "opacity-100" : "opacity-0 group-hover/tree-item:opacity-100"
          )}>
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

// --- SchemaTree: now accepts connection context via props ---

interface SchemaTreeProps {
  projectId: string;
  connectionId: string;
  schema: Schema;
  projectColor: ProjectColor;
  level: number;
}

function SchemaTree({ projectId, connectionId, schema, projectColor: _projectColor, level }: SchemaTreeProps) {
  const queryClient = useQueryClient();
  const addTab = useUIStore((state) => state.addTab);
  const activeTabId = useUIStore((state) => state.activeTabId);
  const tabs = useUIStore((state) => state.tabs);
  const addCreateTableTab = useUIStore((state) => state.addCreateTableTab);
  const addEditTableTab = useUIStore((state) => state.addEditTableTab);
  const openDeleteTableModal = useUIStore((state) => state.openDeleteTableModal);
  const openTruncateTableModal = useUIStore((state) => state.openTruncateTableModal);
  const addImportDataTab = useUIStore((state) => state.addImportDataTab);
  const openSchemaInfoModal = useUIStore((state) => state.openSchemaInfoModal);
  const openDropSchemaModal = useUIStore((state) => state.openDropSchemaModal);
  const addDiagramTab = useUIStore((state) => state.addDiagramTab);
  const showToast = useUIStore((state) => state.showToast);
  const isExpanded = useUIStore((state) => state.expandedSchemas.has(schema.name));
  const toggleSchemaExpanded = useUIStore((state) => state.toggleSchemaExpanded);
  const [schemaMenuOpen, setSchemaMenuOpen] = useState(false);
  const [tableMenuOpen, setTableMenuOpen] = useState<string | null>(null);

  const handleTableClick = (table: Table) => {
    addTab({
      id: generateId(),
      type: "table",
      title: table.name,
      connectionId,
      projectId,
      schema: table.schema,
      table: table.name,
    });
  };

  const isTableActive = (tableName: string) => {
    if (!activeTabId) return false;
    const activeTab = tabs.find((t) => t.id === activeTabId);
    return (
      activeTab?.type === "table" &&
      activeTab.connectionId === connectionId &&
      activeTab.table === tableName &&
      activeTab.schema === schema.name
    );
  };

  const handleCreateTable = (e: React.MouseEvent) => {
    e.stopPropagation();
    addCreateTableTab(connectionId, projectId, schema.name);
  };

  return (
    <ContextMenu
      onOpenChange={setSchemaMenuOpen}
      items={[
        {
          label: "Schema Info",
          icon: <Info className="w-4 h-4" />,
          onClick: () => openSchemaInfoModal(schema.name),
        },
        {
          label: "Schema Diagram",
          icon: <Workflow className="w-4 h-4" />,
          onClick: () => addDiagramTab(connectionId, projectId, schema.name),
        },
        {
          type: "separator" as const,
        },
        {
          label: "Add New Table",
          icon: <Plus className="w-4 h-4" />,
          onClick: () => {
            addCreateTableTab(connectionId, projectId, schema.name);
          },
        },
        {
          label: "Copy Schema Name",
          icon: <Copy className="w-4 h-4" />,
          onClick: () => {
            navigator.clipboard.writeText(schema.name);
            showToast(`Copied "${schema.name}" to clipboard`);
          },
        },
        {
          label: "Copy CREATE SCHEMA",
          icon: <Code className="w-4 h-4" />,
          onClick: () => {
            navigator.clipboard.writeText(`CREATE SCHEMA "${schema.name}";`);
            showToast(`Copied CREATE SCHEMA statement to clipboard`);
          },
        },
        {
          label: "Refresh Schema",
          icon: <RefreshCw className="w-4 h-4" />,
          onClick: () => {
            queryClient.invalidateQueries({
              queryKey: ["schemas", connectionId],
            });
            showToast(`Refreshed schema "${schema.name}"`);
          },
        },
        {
          type: "separator" as const,
        },
        {
          label: "Drop Schema",
          icon: <Trash2 className="w-4 h-4" />,
          variant: "danger" as const,
          onClick: () => openDropSchemaModal(schema.name, schema.tables.length),
        },
      ]}
    >
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
        menuOpen={schemaMenuOpen}
        action={
          <span className="flex items-center gap-0.5">
            <button
              onClick={handleCreateTable}
              className={cn(
                "p-0.5 rounded hover:bg-[var(--bg-tertiary)]",
                "text-[var(--text-muted)] hover:text-[var(--accent)]",
                "transition-colors duration-150"
              )}
              title={`Create table in ${schema.name}`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                e.currentTarget.closest("[data-context-menu]")?.dispatchEvent(
                  new MouseEvent("contextmenu", {
                    bubbles: true,
                    clientX: rect.left,
                    clientY: rect.bottom,
                  })
                );
              }}
              className={cn(
                "p-0.5 rounded hover:bg-[var(--bg-tertiary)]",
                "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                "transition-colors duration-150"
              )}
              title="More actions"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </span>
        }
      >
        {schema.tables.map((table) => (
          <ContextMenu
            key={`${schema.name}.${table.name}`}
            onOpenChange={(open) => setTableMenuOpen(open ? table.name : null)}
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
                    queryKey: ["tableData", connectionId, schema.name, table.name],
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
                        connectionId,
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
                        connectionId,
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
                      addImportDataTab(connectionId, projectId, schema.name, table.name, "csv");
                    },
                  },
                  {
                    label: "Import from JSON",
                    icon: <FileJson className="w-4 h-4" />,
                    onClick: () => {
                      addImportDataTab(connectionId, projectId, schema.name, table.name, "json");
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
                onClick: () => addEditTableTab(connectionId, projectId, schema.name, table.name),
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
              menuOpen={tableMenuOpen === table.name}
              action={
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    e.currentTarget.closest("[data-context-menu]")?.dispatchEvent(
                      new MouseEvent("contextmenu", {
                        bubbles: true,
                        clientX: rect.left,
                        clientY: rect.bottom,
                      })
                    );
                  }}
                  className={cn(
                    "p-0.5 rounded hover:bg-[var(--bg-tertiary)]",
                    "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                    "transition-colors duration-150"
                  )}
                  title="More actions"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              }
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
    </ContextMenu>
  );
}

// --- ConnectionSection: renders a connected project with its schema tree ---

interface ConnectionSectionProps {
  project: Project;
  connectionId: string;
  schemas: Schema[];
  schemasLoading: boolean;
  status: string;
}

function ConnectionSection({ project, connectionId, schemas, schemasLoading, status }: ConnectionSectionProps) {
  const queryClient = useQueryClient();
  const openProjectModal = useUIStore((state) => state.openProjectModal);
  const openDeleteProjectModal = useUIStore((state) => state.openDeleteProjectModal);
  const toggleProjectSpotlight = useUIStore((state) => state.toggleProjectSpotlight);
  const showToast = useUIStore((state) => state.showToast);
  const addDiagramTab = useUIStore((state) => state.addDiagramTab);
  const addQueryTab = useUIStore((state) => state.addQueryTab);
  const addCreateTableTab = useUIStore((state) => state.addCreateTableTab);
  const [isExpanded, setIsExpanded] = useState(true);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [isCreatingSchema, setIsCreatingSchema] = useState(false);
  const [newSchemaName, setNewSchemaName] = useState("");
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const executeSQL = useExecuteSQL();
  const schemaInputRef = useRef<HTMLInputElement>(null);
  const disconnect = useDisconnect();

  useEffect(() => {
    if (isCreatingSchema) {
      requestAnimationFrame(() => schemaInputRef.current?.focus());
    }
  }, [isCreatingSchema]);

  const handleCreateSchema = async () => {
    const trimmed = newSchemaName.trim();
    if (!trimmed) return;
    setSchemaError(null);
    try {
      await executeSQL.mutateAsync({ connectionId, projectId: project.id, sql: `CREATE SCHEMA "${trimmed}"` });
      setIsCreatingSchema(false);
      setNewSchemaName("");
      showToast(`Created schema "${trimmed}"`);
    } catch (err) {
      setSchemaError(err instanceof Error ? err.message : "Failed to create schema");
    }
  };

  const cancelCreateSchema = () => {
    setIsCreatingSchema(false);
    setNewSchemaName("");
    setSchemaError(null);
  };

  const handleDisconnect = () => {
    disconnect.mutate({ projectId: project.id, connectionId });
  };

  const colorConfig = PROJECT_COLORS[project.color];
  const isConnected = status === "connected" || status === "reconnecting";

  return (
    <div className="py-1">
      <ContextMenu
        onOpenChange={setProjectMenuOpen}
        items={[
          {
            label: "New Query",
            icon: <Terminal className="w-4 h-4" />,
            onClick: () => addQueryTab(connectionId, project.id),
          },
          {
            label: "New Table",
            icon: <Table2 className="w-4 h-4" />,
            onClick: () => addCreateTableTab(connectionId, project.id),
          },
          {
            type: "separator" as const,
          },
          {
            label: "Disconnect",
            icon: <Unplug className="w-4 h-4" />,
            variant: "danger" as const,
            onClick: handleDisconnect,
          },
          {
            type: "separator" as const,
          },
          {
            label: "Copy Connection Name",
            icon: <Copy className="w-4 h-4" />,
            onClick: () => {
              navigator.clipboard.writeText(project.name);
              showToast(`Copied "${project.name}" to clipboard`);
            },
          },
          {
            label: "Copy Database Name",
            icon: <Database className="w-4 h-4" />,
            onClick: () => {
              navigator.clipboard.writeText(project.connection.database);
              showToast(`Copied "${project.connection.database}" to clipboard`);
            },
          },
          {
            label: "Schema Diagram",
            icon: <Workflow className="w-4 h-4" />,
            onClick: () => addDiagramTab(connectionId, project.id),
          },
          {
            label: "Create Schema",
            icon: <FolderPlus className="w-4 h-4" />,
            onClick: () => {
              setIsCreatingSchema(true);
              setNewSchemaName("");
              setSchemaError(null);
              if (!isExpanded) setIsExpanded(true);
            },
          },
          {
            label: "Refresh All Schemas",
            icon: <RefreshCw className="w-4 h-4" />,
            onClick: () => {
              queryClient.invalidateQueries({
                queryKey: ["schemas", connectionId],
              });
              showToast("Refreshed all schemas");
            },
          },
          {
            type: "separator" as const,
          },
          {
            label: "Switch Project",
            icon: <ArrowLeftRight className="w-4 h-4" />,
            onClick: () => toggleProjectSpotlight(),
          },
          {
            label: "Edit Project",
            icon: <Pencil className="w-4 h-4" />,
            onClick: () => openProjectModal(project.id),
          },
          {
            type: "separator" as const,
          },
          {
            label: "Delete Project",
            icon: <Trash2 className="w-4 h-4" />,
            variant: "danger" as const,
            onClick: () => openDeleteProjectModal(project.id),
          },
        ]}
      >
        <TreeItem
          label={project.name}
          icon={
            <span className="relative flex items-center justify-center">
              <Database className={cn("w-4 h-4", colorConfig.text)} />
              <span className={cn(
                "absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full",
                isConnected ? "bg-green-500" : "bg-yellow-500"
              )} />
            </span>
          }
          level={0}
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
          menuOpen={projectMenuOpen}
          action={
            <span className="flex items-center gap-0.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addQueryTab(connectionId, project.id);
                }}
                className={cn(
                  "p-0.5 rounded hover:bg-[var(--bg-tertiary)]",
                  "text-[var(--text-muted)] hover:text-[var(--accent)]",
                  "transition-colors duration-150"
                )}
                title="New Query"
              >
                <Terminal className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addCreateTableTab(connectionId, project.id);
                }}
                className={cn(
                  "p-0.5 rounded hover:bg-[var(--bg-tertiary)]",
                  "text-[var(--text-muted)] hover:text-[var(--accent)]",
                  "transition-colors duration-150"
                )}
                title="New Table"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.closest("[data-context-menu]")?.dispatchEvent(
                    new MouseEvent("contextmenu", {
                      bubbles: true,
                      clientX: rect.left,
                      clientY: rect.bottom,
                    })
                  );
                }}
                className={cn(
                  "p-0.5 rounded hover:bg-[var(--bg-tertiary)]",
                  "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                  "transition-colors duration-150"
                )}
                title="More actions"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </span>
          }
        >
          {status === "connecting" ? (
            <div className="text-xs text-[var(--text-muted)] py-1 pl-12">
              Connecting...
            </div>
          ) : isConnected ? (
            schemasLoading ? (
              <div className="text-xs text-[var(--text-muted)] py-1 pl-12">
                Loading schemas...
              </div>
            ) : (
              <>
                {schemas.length > 0 ? (
                  schemas.map((schema) => (
                    <SchemaTree
                      key={schema.name}
                      projectId={project.id}
                      connectionId={connectionId}
                      schema={schema}
                      projectColor={project.color}
                      level={1}
                    />
                  ))
                ) : !isCreatingSchema ? (
                  <div className="text-xs text-[var(--text-muted)] py-1 pl-12">
                    No schemas found
                  </div>
                ) : null}
                {isCreatingSchema && (
                  <div className="select-none" ref={(el) => el?.scrollIntoView({ block: "nearest", behavior: "smooth" })}>
                    <div
                      className="w-full flex items-center gap-2 h-7 text-sm bg-[var(--bg-tertiary)]"
                      style={{ paddingLeft: 12 + 1 * 16 }}
                    >
                      <span className="w-4 h-4 shrink-0" />
                      <FolderClosed className="w-4 h-4 text-[var(--warning)] shrink-0" />
                      <input
                        ref={schemaInputRef}
                        type="text"
                        value={newSchemaName}
                        onChange={(e) => {
                          setNewSchemaName(e.target.value);
                          setSchemaError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleCreateSchema();
                          } else if (e.key === "Escape") {
                            cancelCreateSchema();
                          }
                        }}
                        onBlur={() => {
                          if (!newSchemaName.trim() && !schemaError) {
                            cancelCreateSchema();
                          }
                        }}
                        placeholder="schema name"
                        spellCheck={false}
                        autoComplete="off"
                        className={cn(
                          "flex-1 min-w-0 bg-transparent text-sm",
                          "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50",
                          "focus:outline-none",
                          schemaError
                            ? "border-b border-red-500"
                            : "border-none"
                        )}
                      />
                    </div>
                    {schemaError && (
                      <div
                        className="text-[11px] text-red-400 py-0.5 pr-2 truncate"
                        style={{ paddingLeft: 12 + 1 * 16 + 24 }}
                        title={schemaError}
                      >
                        {schemaError}
                      </div>
                    )}
                  </div>
                )}
              </>
            )
          ) : (
            <div className="text-xs text-[var(--text-muted)] py-1 pl-12">
              {status === "error" ? "Connection error" : "Not connected"}
            </div>
          )}
        </TreeItem>
      </ContextMenu>
    </div>
  );
}

// --- DisconnectedProject: shows a disconnected project as a simple row ---

interface DisconnectedProjectProps {
  project: Project;
}

function DisconnectedProject({ project }: DisconnectedProjectProps) {
  const openProjectModal = useUIStore((state) => state.openProjectModal);
  const openDeleteProjectModal = useUIStore((state) => state.openDeleteProjectModal);
  const showToast = useUIStore((state) => state.showToast);
  const connect = useConnect();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleConnect = () => {
    connect.mutate({ project });
  };

  return (
    <div className="py-0.5">
      <ContextMenu
        onOpenChange={setMenuOpen}
        items={[
          {
            label: "Connect",
            icon: <Plug className="w-4 h-4" />,
            onClick: handleConnect,
          },
          {
            type: "separator" as const,
          },
          {
            label: "Copy Connection Name",
            icon: <Copy className="w-4 h-4" />,
            onClick: () => {
              navigator.clipboard.writeText(project.name);
              showToast(`Copied "${project.name}" to clipboard`);
            },
          },
          {
            label: "Edit Project",
            icon: <Pencil className="w-4 h-4" />,
            onClick: () => openProjectModal(project.id),
          },
          {
            type: "separator" as const,
          },
          {
            label: "Delete Project",
            icon: <Trash2 className="w-4 h-4" />,
            variant: "danger" as const,
            onClick: () => openDeleteProjectModal(project.id),
          },
        ]}
      >
        <div
          className={cn(
            "group/tree-item w-full flex items-center gap-2 h-7 text-sm cursor-pointer",
            "hover:bg-[var(--bg-tertiary)] transition-colors duration-150",
            "text-[var(--text-muted)]"
          )}
          style={{ paddingLeft: 12 }}
          onClick={handleConnect}
        >
          <span className="w-4 h-4 shrink-0" />
          <span className="relative flex items-center justify-center shrink-0">
            <Database className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-gray-500" />
          </span>
          <span className="truncate text-left">{project.name}</span>
          <span className={cn(
            "transition-opacity duration-150 pr-2 ml-auto",
            menuOpen ? "opacity-100" : "opacity-0 group-hover/tree-item:opacity-100"
          )}>
            <span className="flex items-center gap-0.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleConnect();
                }}
                className={cn(
                  "p-0.5 rounded hover:bg-[var(--bg-tertiary)]",
                  "text-[var(--text-muted)] hover:text-[var(--accent)]",
                  "transition-colors duration-150"
                )}
                title="Connect"
              >
                <Plug className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.closest("[data-context-menu]")?.dispatchEvent(
                    new MouseEvent("contextmenu", {
                      bubbles: true,
                      clientX: rect.left,
                      clientY: rect.bottom,
                    })
                  );
                }}
                className={cn(
                  "p-0.5 rounded hover:bg-[var(--bg-tertiary)]",
                  "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                  "transition-colors duration-150"
                )}
                title="More actions"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </span>
          </span>
        </div>
      </ContextMenu>
    </div>
  );
}

// --- Main Sidebar ---

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
  const projects = useProjectStore((state) => state.projects);
  const connections = useProjectStore((state) => state.connections);
  const [isResizing, setIsResizing] = useState(false);

  // Split projects into connected and disconnected
  const connectedProjects: Array<{ project: Project; connectionId: string; schemas: Schema[]; schemasLoading: boolean; status: string }> = [];
  const disconnectedProjects: Project[] = [];

  for (const project of projects) {
    const conn = connections[project.id];
    if (conn) {
      connectedProjects.push({
        project,
        connectionId: conn.connectionId,
        schemas: conn.schemas,
        schemasLoading: conn.schemasLoading,
        status: conn.status,
      });
    } else {
      disconnectedProjects.push(project);
    }
  }

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-[var(--bg-secondary)]",
        "border-r border-[var(--border-color)]",
        !isResizing && "transition-[width] duration-200 ease-out",
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
            {projects.length === 0 ? (
              <div className="p-4 text-center text-[var(--text-muted)] text-sm">
                No projects yet
              </div>
            ) : (
              <>
                {/* Connected projects */}
                {connectedProjects.map(({ project, connectionId, schemas, schemasLoading, status }) => (
                  <ConnectionSection
                    key={project.id}
                    project={project}
                    connectionId={connectionId}
                    schemas={schemas}
                    schemasLoading={schemasLoading}
                    status={status}
                  />
                ))}

                {/* Divider between connected and disconnected */}
                {connectedProjects.length > 0 && disconnectedProjects.length > 0 && (
                  <div className="mx-3 my-1 border-t border-[var(--border-color)]" />
                )}

                {/* Disconnected projects */}
                {disconnectedProjects.map((project) => (
                  <DisconnectedProject key={project.id} project={project} />
                ))}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-[var(--border-color)] shrink-0">
            <button
              onClick={() => openProjectModal()}
              className={cn(
                "w-full flex items-center justify-center gap-2 h-8",
                "bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)]",
                "rounded-[4px] text-sm text-[var(--text-secondary)]",
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
        <ResizeHandle width={width} onWidthChange={onWidthChange} onResizingChange={setIsResizing} />
      )}
    </aside>
  );
}

interface ResizeHandleProps {
  width: number;
  onWidthChange: (width: number) => void;
  onResizingChange: (resizing: boolean) => void;
}

function ResizeHandle({ width, onWidthChange, onResizingChange }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    onResizingChange(true);

    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(180, Math.min(400, startWidth + delta));
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      onResizingChange(false);
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
