import { useEffect, useState, useRef } from "react";
import {
  Database,
  X,
  Download,
  RefreshCw,
  Loader2,
  Workflow,
  LayoutGrid,
  Home,
  History,
} from "lucide-react";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { StatusBar } from "./StatusBar";
import { TabContent } from "./TabContent";
import { Dashboard } from "./Dashboard";
import { useProjectStore } from "../../stores/projectStore";
import { useUIStore } from "../../stores/uiStore";
import { useGlobalKeyboardShortcuts } from "../../hooks/useKeyboard";
import { useConnectionHealthCheck } from "../../hooks/useConnectionHealthCheck";
import { useUpdateCheck } from "../../hooks/useUpdateCheck";
import { cn, PROJECT_COLORS } from "../../lib/utils";

function TitleBar() {
  const projects = useProjectStore((state) => state.projects);
  const connections = useProjectStore((state) => state.connections);
  const toggleProjectSpotlight = useUIStore(
    (state) => state.toggleProjectSpotlight
  );
  const addDiagramTab = useUIStore((state) => state.addDiagramTab);
  const addHistoryTab = useUIStore((state) => state.addHistoryTab);

  const [historyPopoverOpen, setHistoryPopoverOpen] = useState(false);
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const historyPopoverRef = useRef<HTMLDivElement>(null);
  const [diagramPopoverOpen, setDiagramPopoverOpen] = useState(false);
  const diagramButtonRef = useRef<HTMLButtonElement>(null);
  const diagramPopoverRef = useRef<HTMLDivElement>(null);

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

  // Close popovers on outside click
  useEffect(() => {
    if (!historyPopoverOpen && !diagramPopoverOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (historyPopoverOpen &&
        historyPopoverRef.current && !historyPopoverRef.current.contains(target) &&
        historyButtonRef.current && !historyButtonRef.current.contains(target)
      ) {
        setHistoryPopoverOpen(false);
      }
      if (diagramPopoverOpen &&
        diagramPopoverRef.current && !diagramPopoverRef.current.contains(target) &&
        diagramButtonRef.current && !diagramButtonRef.current.contains(target)
      ) {
        setDiagramPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [historyPopoverOpen, diagramPopoverOpen]);

  const connectedProjects = projects.filter((p) => connections[p.id]);

  const handleDiagramClick = () => {
    if (connectedProjects.length === 1) {
      const project = connectedProjects[0];
      const conn = connections[project.id];
      if (conn) {
        addDiagramTab(conn.connectionId, project.id);
      }
    } else {
      setDiagramPopoverOpen((prev) => !prev);
      setHistoryPopoverOpen(false);
    }
  };

  const handleDiagramSelect = (projectId: string) => {
    const conn = connections[projectId];
    if (conn) {
      addDiagramTab(conn.connectionId, projectId);
      setDiagramPopoverOpen(false);
    }
  };

  const handleHistoryClick = () => {
    if (connectedProjects.length === 1) {
      const project = connectedProjects[0];
      const conn = connections[project.id];
      if (conn) {
        addHistoryTab(conn.connectionId, project.id);
      }
    } else {
      setHistoryPopoverOpen((prev) => !prev);
      setDiagramPopoverOpen(false);
    }
  };

  const handleHistorySelect = (projectId: string) => {
    const conn = connections[projectId];
    if (conn) {
      addHistoryTab(conn.connectionId, projectId);
      setHistoryPopoverOpen(false);
    }
  };

  const hasActiveConnection = connectedProjects.length > 0;
  const showDashboard = useUIStore((state) => state.showDashboard);
  const setShowDashboard = useUIStore((state) => state.setShowDashboard);

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

      {/* Home button - only show when there are active connections to return to */}
      {hasActiveConnection && <button
        onClick={() => setShowDashboard(!showDashboard)}
        className={cn(
          "flex items-center gap-1.5 px-2 h-8 rounded",
          "hover:bg-[var(--bg-tertiary)] transition-colors duration-150",
          "text-xs",
          showDashboard ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
        )}
        title="Dashboard"
      >
        <Home className="w-3.5 h-3.5" />
      </button>}

      {/* Projects button */}
      {projects.length > 0 && (
        <button
          onClick={toggleProjectSpotlight}
          className={cn(
            "flex items-center gap-1.5 px-2 h-8 rounded",
            "hover:bg-[var(--bg-tertiary)] transition-colors duration-150",
            "text-xs text-[var(--text-muted)]"
          )}
          title="Switch project (Cmd+P)"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Projects</span>
          <kbd className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
            &#8984;P
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

      {/* Right-side actions */}
      {hasActiveConnection && (
        <>
          <div className="relative">
            <button
              ref={historyButtonRef}
              onClick={handleHistoryClick}
              className={cn(
                "flex items-center gap-1.5 px-2 h-8 rounded",
                "hover:bg-[var(--bg-tertiary)] transition-colors duration-150",
                "text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
              title="Commit History"
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
            </button>

            {/* History database picker popover */}
            {historyPopoverOpen && (
              <div
                ref={historyPopoverRef}
                className={cn(
                  "absolute top-full right-0 mt-1",
                  "w-56 bg-[var(--bg-primary)] border border-[var(--border-color)]",
                  "rounded-[4px] shadow-lg overflow-hidden z-50"
                )}
              >
                <div className="px-3 py-2 border-b border-[var(--border-color)]">
                  <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                    View history for
                  </span>
                </div>
                <div className="py-1 max-h-48 overflow-y-auto">
                  {connectedProjects.map((project) => {
                    const colorConfig = PROJECT_COLORS[project.color];
                    return (
                      <button
                        key={project.id}
                        onClick={() => handleHistorySelect(project.id)}
                        className={cn(
                          "flex items-center gap-2 w-full px-3 py-1.5 text-left",
                          "hover:bg-[var(--bg-tertiary)] transition-colors duration-150"
                        )}
                      >
                        <span className={cn("w-2 h-2 rounded-full shrink-0", colorConfig.dot)} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-[var(--text-primary)] truncate">{project.name}</div>
                          <div className="text-[10px] text-[var(--text-muted)] truncate">{project.connection.database}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <button
              ref={diagramButtonRef}
              onClick={handleDiagramClick}
              className={cn(
                "flex items-center gap-1.5 px-2 h-8 rounded",
                "hover:bg-[var(--bg-tertiary)] transition-colors duration-150",
                "text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
              title="Schema Diagram"
            >
              <Workflow className="w-3.5 h-3.5" />
              <span>Diagram</span>
            </button>

            {/* Diagram database picker popover */}
            {diagramPopoverOpen && (
              <div
                ref={diagramPopoverRef}
                className={cn(
                  "absolute top-full right-0 mt-1",
                  "w-56 bg-[var(--bg-primary)] border border-[var(--border-color)]",
                  "rounded-[4px] shadow-lg overflow-hidden z-50"
                )}
              >
                <div className="px-3 py-2 border-b border-[var(--border-color)]">
                  <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                    View diagram for
                  </span>
                </div>
                <div className="py-1 max-h-48 overflow-y-auto">
                  {connectedProjects.map((project) => {
                    const colorConfig = PROJECT_COLORS[project.color];
                    return (
                      <button
                        key={project.id}
                        onClick={() => handleDiagramSelect(project.id)}
                        className={cn(
                          "flex items-center gap-2 w-full px-3 py-1.5 text-left",
                          "hover:bg-[var(--bg-tertiary)] transition-colors duration-150"
                        )}
                      >
                        <span className={cn("w-2 h-2 rounded-full shrink-0", colorConfig.dot)} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-[var(--text-primary)] truncate">{project.name}</div>
                          <div className="text-[10px] text-[var(--text-muted)] truncate">{project.connection.database}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Right spacer to balance macOS traffic lights */}
      <div className="w-[12px] shrink-0" />
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
  const showDashboard = useUIStore((state) => state.showDashboard);
  const connections = useProjectStore((state) => state.connections);

  // Global keyboard shortcuts (Cmd+W to close tab, Cmd+K for command palette, etc.)
  useGlobalKeyboardShortcuts();

  // Live database connection health check
  useConnectionHealthCheck();

  const hasAnyConnection = Object.keys(connections).length > 0;
  const showTabContent = activeTabId !== null;

  // Layout modes:
  // 1. No active connections OR showDashboard → Dashboard
  // 2. Connected + not on dashboard → Sidebar + workspace (tabs or empty state)

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--bg-primary)]">
      {/* Title Bar */}
      <TitleBar />

      {/* Update Banner */}
      <UpdateBanner />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {!hasAnyConnection || showDashboard ? (
          <Dashboard />
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="rounded-2xl bg-[var(--bg-secondary)] p-6 mb-6">
        <Database className="w-12 h-12 text-[var(--text-muted)]" />
      </div>
      <h2 className="text-lg font-medium text-[var(--text-primary)] mb-2">
        Select a table from the sidebar
      </h2>
      <p className="text-[var(--text-muted)]">
        Choose a table from the sidebar to view and edit its data
      </p>
    </div>
  );
}
