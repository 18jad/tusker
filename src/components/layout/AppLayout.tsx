import { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  Database,
  Check,
  Settings,
  Plus,
  Plug,
  Unplug,
  Loader2,
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
import { cn, PROJECT_COLORS } from "../../lib/utils";

interface ProjectSwitcherProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

function ProjectSwitcher({ isOpen, onToggle, onClose }: ProjectSwitcherProps) {
  const projects = useProjectStore((state) => state.projects);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const connectionStatus = useProjectStore((state) => state.connectionStatus);
  const setActiveProject = useProjectStore((state) => state.setActiveProject);
  const deleteProject = useProjectStore((state) => state.deleteProject);
  const openProjectModal = useUIStore((state) => state.openProjectModal);
  const closeAllTabs = useUIStore((state) => state.closeAllTabs);
  const clearChanges = useChangesStore((state) => state.clearChanges);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const connect = useConnect();
  const disconnect = useDisconnect();

  const activeProject = projects.find((p) => p.id === activeProjectId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose]);

  const handleSelectProject = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    // Disconnect from current if connected
    if (connectionStatus === "connected") {
      await disconnect.mutateAsync();
    }

    // Clear tabs and staged changes from previous project
    closeAllTabs();
    clearChanges();

    setActiveProject(projectId);

    // Auto-connect to the selected project
    connect.mutate(project.connection);

    onClose();
  };

  const handleConnect = () => {
    if (!activeProject) return;
    connect.mutate(activeProject.connection);
    onClose();
  };

  const handleDisconnect = () => {
    disconnect.mutate();
    onClose();
  };

  const handleNewProject = () => {
    openProjectModal();
    onClose();
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    // Disconnect if deleting the active project
    if (projectId === activeProjectId && connectionStatus === "connected") {
      await disconnect.mutateAsync();
    }
    deleteProject(projectId);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center gap-2 px-3 h-8 rounded",
          "hover:bg-[var(--bg-tertiary)] transition-colors duration-150",
          "text-sm"
        )}
      >
        {activeProject ? (
          <>
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                PROJECT_COLORS[activeProject.color].dot
              )}
            />
            <span className="text-[var(--text-primary)]">
              {activeProject.name}
            </span>
          </>
        ) : (
          <>
            <Database className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="text-[var(--text-muted)]">Select Project</span>
          </>
        )}
        <ChevronDown
          className={cn(
            "w-4 h-4 text-[var(--text-muted)]",
            "transition-transform duration-150",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={cn(
            "absolute top-full left-0 mt-1 z-50",
            "min-w-[220px] py-1 rounded-md shadow-lg",
            "bg-[var(--bg-secondary)] border border-[var(--border-color)]",
            "animate-in fade-in-0 zoom-in-95 duration-150"
          )}
        >
          {projects.length > 0 ? (
            <>
              {projects.map((project) => {
                const colorConfig = PROJECT_COLORS[project.color];
                const isActive = project.id === activeProjectId;

                return (
                  <div
                    key={project.id}
                    className={cn(
                      "group w-full flex items-center gap-3 px-3 py-2",
                      "hover:bg-[var(--bg-tertiary)] transition-colors duration-150",
                      "text-left text-sm cursor-pointer"
                    )}
                    onClick={() => handleSelectProject(project.id)}
                  >
                    <div
                      className={cn("w-2.5 h-2.5 rounded-full shrink-0", colorConfig.dot)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[var(--text-primary)] truncate">
                        {project.name}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] truncate">
                        {project.connection.host}:{project.connection.port}/
                        {project.connection.database}
                      </div>
                    </div>
                    {isActive && (
                      <Check className="w-4 h-4 text-[var(--accent)] shrink-0" />
                    )}
                    <button
                      onClick={(e) => handleDeleteProject(e, project.id)}
                      className={cn(
                        "p-1 rounded shrink-0",
                        "opacity-0 group-hover:opacity-100",
                        "text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10",
                        "transition-all duration-150"
                      )}
                      title="Delete project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
              <div className="h-px bg-[var(--border-color)] my-1" />
            </>
          ) : (
            <div className="px-3 py-2 text-sm text-[var(--text-muted)]">
              No projects yet
            </div>
          )}

          <button
            onClick={handleNewProject}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2",
              "hover:bg-[var(--bg-tertiary)] transition-colors duration-150",
              "text-sm text-[var(--text-secondary)]"
            )}
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>

          {activeProject && (
            <>
              {connectionStatus === "disconnected" || connectionStatus === "error" ? (
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
                  <span>{disconnect.isPending ? "Disconnecting..." : "Disconnect"}</span>
                </button>
              ) : null}
              <button
                onClick={() => {
                  openProjectModal(activeProject.id);
                  onClose();
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2",
                  "hover:bg-[var(--bg-tertiary)] transition-colors duration-150",
                  "text-sm text-[var(--text-secondary)]"
                )}
              >
                <Settings className="w-4 h-4" />
                <span>Project Settings</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TitleBar() {
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);

  return (
    <header
      className={cn(
        "h-10 flex items-center px-3 shrink-0",
        "bg-[var(--bg-secondary)] border-b border-[var(--border-color)]",
        "select-none"
      )}
      // Enable window dragging for Tauri (macOS style)
      data-tauri-drag-region
    >
      {/* macOS traffic lights placeholder area */}
      <div className="w-[68px] shrink-0" data-tauri-drag-region />

      {/* Project switcher */}
      <ProjectSwitcher
        isOpen={isSwitcherOpen}
        onToggle={() => setIsSwitcherOpen(!isSwitcherOpen)}
        onClose={() => setIsSwitcherOpen(false)}
      />

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

  // Determine what content to show
  const showTabContent = activeTabId && connectionStatus === "connected";

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--bg-primary)]">
      {/* Title Bar */}
      <TitleBar />

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
  const projects = useProjectStore((state) => state.projects);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const connectionStatus = useProjectStore((state) => state.connectionStatus);
  const error = useProjectStore((state) => state.error);
  const activeProject = projects.find((p) => p.id === activeProjectId);

  const connect = useConnect();

  const handleConnect = () => {
    if (!activeProject) return;
    connect.mutate(activeProject.connection);
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
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <Database className="w-12 h-12 text-[var(--text-muted)] mb-4" />
        <p className="text-[var(--text-secondary)]">
          Select a project from the dropdown above to get started
        </p>
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
