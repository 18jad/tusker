import { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  Database,
  Plug,
  Unplug,
  Loader2,
  ArrowLeftRight,
  Plus,
  X,
  Download,
  RefreshCw,
  Pencil,
  Trash2,
} from "lucide-react";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { StatusBar } from "./StatusBar";
import { TabContent } from "./TabContent";
import { useProjectStore } from "../../stores/projectStore";
import { useUIStore } from "../../stores/uiStore";
import { useChangesStore } from "../../stores/changesStore";
import { useConnect, useDisconnect } from "../../hooks/useDatabase";
import { useGlobalKeyboardShortcuts } from "../../hooks/useKeyboard";
import { useConnectionHealthCheck } from "../../hooks/useConnectionHealthCheck";
import { useUpdateCheck } from "../../hooks/useUpdateCheck";
import { cn, PROJECT_COLORS } from "../../lib/utils";

function ProjectMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const projects = useProjectStore((state) => state.projects);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const connectionStatus = useProjectStore((state) => state.connectionStatus);
  const openProjectModal = useUIStore((state) => state.openProjectModal);
  const openDeleteProjectModal = useUIStore((state) => state.openDeleteProjectModal);

  const connect = useConnect();
  const disconnect = useDisconnect();

  const activeProject = projects.find((p) => p.id === activeProjectId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleConnect = () => {
    if (!activeProject) return;
    connect.mutate(activeProject.connection);
    setIsOpen(false);
  };

  const handleDisconnect = () => {
    disconnect.mutate();
    setIsOpen(false);
  };

  if (!activeProject) return null;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 h-8 rounded",
          "hover:bg-[var(--bg-tertiary)] transition-colors duration-150",
          "text-sm"
        )}
      >
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            PROJECT_COLORS[activeProject.color].dot
          )}
        />
        <span className="text-[var(--text-primary)]">{activeProject.name}</span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-[var(--text-muted)]",
            "transition-transform duration-150",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute top-full left-0 mt-1 z-50",
            "min-w-[180px] py-1 rounded-md shadow-lg",
            "bg-[var(--bg-secondary)] border border-[var(--border-color)]",
            "animate-in fade-in-0 zoom-in-95 duration-150"
          )}
        >
          {connectionStatus === "disconnected" ||
          connectionStatus === "error" ? (
            <button
              onClick={handleConnect}
              disabled={connect.isPending}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2",
                "hover:bg-[var(--bg-tertiary)] transition-colors duration-150",
                "text-sm text-[var(--success)]"
              )}
            >
              {connect.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plug className="w-4 h-4" />
              )}
              <span>{connect.isPending ? "Connecting..." : "Connect"}</span>
            </button>
          ) : connectionStatus === "connected" ? (
            <button
              onClick={handleDisconnect}
              disabled={disconnect.isPending}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2",
                "hover:bg-[var(--bg-tertiary)] transition-colors duration-150",
                "text-sm text-[var(--danger)]"
              )}
            >
              {disconnect.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Unplug className="w-4 h-4" />
              )}
              <span>
                {disconnect.isPending ? "Disconnecting..." : "Disconnect"}
              </span>
            </button>
          ) : null}

          <div className="my-1 h-px bg-[var(--border-color)]" />

          <button
            onClick={() => {
              openProjectModal(activeProject.id);
              setIsOpen(false);
            }}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2",
              "hover:bg-[var(--bg-tertiary)] transition-colors duration-150",
              "text-sm text-[var(--text-secondary)]"
            )}
          >
            <Pencil className="w-4 h-4" />
            <span>Edit Project</span>
          </button>

          <button
            onClick={() => {
              setIsOpen(false);
              openDeleteProjectModal(activeProject.id);
            }}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2",
              "hover:bg-red-500/10 transition-colors duration-150",
              "text-sm text-red-400"
            )}
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Project</span>
          </button>
        </div>
      )}
    </div>
  );
}

function TitleBar() {
  const projects = useProjectStore((state) => state.projects);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const toggleProjectSpotlight = useUIStore(
    (state) => state.toggleProjectSpotlight
  );

  const activeProject = projects.find((p) => p.id === activeProjectId);

  // Keyboard shortcut for project spotlight (Ctrl/Cmd + P)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        toggleProjectSpotlight();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toggleProjectSpotlight]);

  return (
    <header
      className={cn(
        "h-10 flex items-center shrink-0",
        "bg-[var(--bg-secondary)] border-b border-[var(--border-color)]",
        "select-none"
      )}
      // Enable window dragging for Tauri (macOS style)
      data-tauri-drag-region
    >
      {/* Space for macOS traffic lights (overlay titlebar) */}
      <div className="w-[78px] shrink-0" data-tauri-drag-region />

      {/* Project menu (manage current project) */}
      {activeProject ? (
        <ProjectMenu />
      ) : (
        <button
          onClick={toggleProjectSpotlight}
          className={cn(
            "flex items-center gap-2 px-2 h-8 rounded",
            "hover:bg-[var(--bg-tertiary)] transition-colors duration-150",
            "text-sm"
          )}
        >
          <Database className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-[var(--text-muted)]">Select Project</span>
        </button>
      )}

      {/* Switch project button - only show when a project is selected */}
      {activeProject && (
        <button
          onClick={toggleProjectSpotlight}
          className={cn(
            "flex items-center gap-1.5 px-2 h-8 rounded ml-2",
            "hover:bg-[var(--bg-tertiary)] transition-colors duration-150",
            "text-xs text-[var(--text-muted)]"
          )}
          title="Switch project (Ctrl+P)"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span>Switch</span>
          <kbd className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
            ⌘P
          </kbd>
        </button>
      )}

      {/* Spacer for centering */}
      <div className="flex-1" data-tauri-drag-region />

      {/* App title (centered) */}
      <div
        className="absolute left-1/2 -translate-x-1/2 text-sm text-[var(--text-muted)] pointer-events-none"
        data-tauri-drag-region
      >
        Tusker
      </div>
    </header>
  );
}

function UpdateBanner() {
  const { status, version, progress, dismissed, installUpdate, dismiss } =
    useUpdateCheck();

  if (dismissed || (status !== "available" && status !== "downloading" && status !== "installed")) {
    return null;
  }

  return (
    <div
      className={cn(
        "h-8 flex items-center justify-center gap-3 px-4 shrink-0",
        "bg-[var(--accent)]/10 border-b border-[var(--accent)]/20",
        "text-xs text-[var(--accent)]"
      )}
    >
      {status === "available" && (
        <>
          <span>Tusker v{version} is available</span>
          <button
            onClick={installUpdate}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded",
              "bg-[var(--accent)] text-white",
              "hover:bg-[var(--accent-hover)] transition-colors duration-150",
              "text-xs font-medium"
            )}
          >
            <Download className="w-3 h-3" />
            Update Now
          </button>
        </>
      )}

      {status === "downloading" && (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Downloading update... {progress}%</span>
          <div className="w-32 h-1.5 rounded-full bg-[var(--accent)]/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </>
      )}

      {status === "installed" && (
        <>
          <RefreshCw className="w-3 h-3" />
          <span>Update installed — restart Tusker to apply</span>
        </>
      )}

      <button
        onClick={dismiss}
        className={cn(
          "ml-auto p-0.5 rounded",
          "hover:bg-[var(--accent)]/20 transition-colors duration-150"
        )}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

interface AppLayoutProps {
  children?: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const sidebarWidth = useUIStore((state) => state.sidebarWidth);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const setSidebarWidth = useUIStore((state) => state.setSidebarWidth);
  const activeTabId = useUIStore((state) => state.activeTabId);
  const connectionStatus = useProjectStore((state) => state.connectionStatus);

  // Global keyboard shortcuts (Cmd+W to close tab, Cmd+K for command palette, etc.)
  useGlobalKeyboardShortcuts();

  // Live database connection health check
  useConnectionHealthCheck();

  // Determine what content to show
  const showTabContent = activeTabId && (connectionStatus === "connected" || connectionStatus === "reconnecting");

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--bg-primary)]">
      {/* Title Bar */}
      <TitleBar />

      {/* Update Banner */}
      <UpdateBanner />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          isCollapsed={sidebarCollapsed}
          width={sidebarWidth}
          onToggle={toggleSidebar}
          onWidthChange={setSidebarWidth}
        />

        {/* Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Tab Bar */}
          <TabBar />

          {/* Content */}
          <div className="flex-1 overflow-hidden bg-[var(--bg-primary)]">
            {children || (showTabContent ? <TabContent /> : <EmptyState />)}
          </div>
        </main>
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  );
}

function EmptyState() {
  const openProjectModal = useUIStore((state) => state.openProjectModal);
  const closeAllTabs = useUIStore((state) => state.closeAllTabs);
  const projects = useProjectStore((state) => state.projects);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const setActiveProject = useProjectStore((state) => state.setActiveProject);
  const connectionStatus = useProjectStore((state) => state.connectionStatus);
  const error = useProjectStore((state) => state.error);
  const clearChanges = useChangesStore((state) => state.clearChanges);
  const activeProject = projects.find((p) => p.id === activeProjectId);

  const connect = useConnect();
  const disconnect = useDisconnect();

  const handleConnect = () => {
    if (!activeProject) return;
    connect.mutate(activeProject.connection);
  };

  const handleQuickSelect = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    if (connectionStatus === "connected") {
      await disconnect.mutateAsync();
    }

    closeAllTabs();
    clearChanges();
    setActiveProject(projectId);
    connect.mutate(project.connection);
  };

  if (projects.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <Database className="w-16 h-16 text-[var(--text-muted)] mb-4" />
        <h2 className="text-xl font-medium text-[var(--text-primary)] mb-2">
          Welcome to Tusker
        </h2>
        <p className="text-[var(--text-secondary)] mb-6 max-w-md">
          Connect to your PostgreSQL database to browse tables, run queries, and
          manage your data with ease.
        </p>
        <button
          onClick={() => openProjectModal()}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md",
            "bg-[var(--accent)] hover:bg-[var(--accent-hover)]",
            "text-white font-medium",
            "transition-colors duration-150"
          )}
        >
          <Plus className="w-4 h-4" />
          Create Your First Project
        </button>
      </div>
    );
  }

  if (!activeProjectId) {
    const recentProjects = projects.slice(0, 5);

    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <Database className="w-12 h-12 text-[var(--text-muted)] mb-4" />
        <h2 className="text-lg font-medium text-[var(--text-primary)] mb-2">
          Select a Project
        </h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          Choose a project to connect to your database
        </p>

        {/* Recent projects list */}
        <div className="w-full max-w-md space-y-2">
          {recentProjects.map((project) => {
            const colorConfig = PROJECT_COLORS[project.color];
            return (
              <button
                key={project.id}
                onClick={() => handleQuickSelect(project.id)}
                disabled={connect.isPending}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer",
                  "bg-[var(--bg-secondary)] border border-[var(--border-color)]",
                  "hover:bg-[var(--bg-tertiary)] hover:border-[var(--accent)]/50",
                  "transition-all duration-150 text-left",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <div
                  className={cn(
                    "w-3 h-3 rounded-full shrink-0",
                    colorConfig.dot
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {project.name}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] truncate">
                    {project.connection.host}:{project.connection.port}/
                    {project.connection.database}
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-[var(--text-muted)] -rotate-90" />
              </button>
            );
          })}
        </div>

        {/* New project button */}
        <button
          onClick={() => openProjectModal()}
          className={cn(
            "mt-4 flex items-center gap-2 px-4 py-2 rounded-md cursor-pointer",
            "text-sm text-[var(--text-secondary)]",
            "hover:bg-[var(--bg-tertiary)] transition-colors duration-150"
          )}
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>
    );
  }

  // Project selected but not connected
  if (connectionStatus === "disconnected" || connectionStatus === "error") {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="rounded-2xl bg-[var(--bg-secondary)] p-6 mb-6">
          <Plug className="w-12 h-12 text-[var(--text-muted)]" />
        </div>
        <h2 className="text-xl font-medium text-[var(--text-primary)] mb-2">
          Connect to {activeProject?.name}
        </h2>
        <p className="text-[var(--text-secondary)] mb-6 max-w-md">
          Click the button below to establish a connection to your database.
        </p>
        {error && (
          <div className="mb-4 px-4 py-2 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm max-w-md">
            {error}
          </div>
        )}
        <button
          onClick={handleConnect}
          disabled={connect.isPending}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md",
            "bg-[var(--success)] hover:bg-green-600",
            "text-white font-medium",
            "transition-colors duration-150",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {connect.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Plug className="w-4 h-4" />
              Connect
            </>
          )}
        </button>
      </div>
    );
  }

  // Connecting
  if (connectionStatus === "connecting") {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <Loader2 className="w-12 h-12 text-[var(--accent)] animate-spin mb-4" />
        <p className="text-[var(--text-secondary)]">
          Connecting to {activeProject?.name}...
        </p>
      </div>
    );
  }

  // Connected - show table selection prompt
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <Database className="w-12 h-12 text-[var(--success)] mb-4" />
      <h2 className="text-lg font-medium text-[var(--text-primary)] mb-2">
        Connected to {activeProject?.name}
      </h2>
      <p className="text-[var(--text-muted)]">
        Select a table from the sidebar to view its data
      </p>
    </div>
  );
}
