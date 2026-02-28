import { useEffect } from "react";
import {
  Database,
  X,
  Download,
  RefreshCw,
  Loader2,
  Workflow,
  LayoutGrid,
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
import { cn } from "../../lib/utils";

function TitleBar() {
  const projects = useProjectStore((state) => state.projects);
  const toggleProjectSpotlight = useUIStore(
    (state) => state.toggleProjectSpotlight
  );
  const addDiagramTab = useUIStore((state) => state.addDiagramTab);
  const getActiveConnectionId = useUIStore(
    (state) => state.getActiveConnectionId
  );
  const getActiveProjectId = useUIStore((state) => state.getActiveProjectId);

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

  const handleOpenDiagram = () => {
    const connectionId = getActiveConnectionId();
    const projectId = getActiveProjectId();
    if (connectionId && projectId) {
      addDiagramTab(connectionId, projectId);
    }
  };

  const hasActiveConnection = !!getActiveConnectionId();

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
        <button
          onClick={handleOpenDiagram}
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
  const connections = useProjectStore((state) => state.connections);

  // Global keyboard shortcuts (Cmd+W to close tab, Cmd+K for command palette, etc.)
  useGlobalKeyboardShortcuts();

  // Live database connection health check
  useConnectionHealthCheck();

  const hasAnyConnection = Object.keys(connections).length > 0;
  const showTabContent = activeTabId !== null;

  // Layout modes:
  // 1. No active connections → Dashboard (Pencil design: stats, grid, quick connect, activity)
  // 2. Connected → Sidebar + workspace (tabs or empty state)

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--bg-primary)]">
      {/* Title Bar */}
      <TitleBar />

      {/* Update Banner */}
      <UpdateBanner />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {!hasAnyConnection ? (
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
