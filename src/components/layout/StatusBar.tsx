import { useState, useRef, useEffect } from "react";
import { Database, FileEdit, History, Unplug, ChevronUp } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useUIStore } from "../../stores/uiStore";
import { useChangesStore } from "../../stores/changesStore";
import { useDisconnect } from "../../hooks/useDatabase";
import { cn } from "../../lib/utils";
import { PROJECT_COLORS } from "../../lib/utils";

export function StatusBar() {
  const projects = useProjectStore((state) => state.projects);
  const connections = useProjectStore((state) => state.connections);
  const tabs = useUIStore((state) => state.tabs);
  const activeTabId = useUIStore((state) => state.activeTabId);
  const addStagedChangesTab = useUIStore((state) => state.addStagedChangesTab);
  const addHistoryTab = useUIStore((state) => state.addHistoryTab);
  const changes = useChangesStore((state) => state.changes);

  const [popupOpen, setPopupOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Derive active tab connection info
  const activeTab = activeTabId ? tabs.find((t) => t.id === activeTabId) : undefined;
  const activeProjectId = activeTab?.projectId;
  const activeConnectionId = activeTab?.connectionId;

  // Connected projects list
  const connectedProjects = projects.filter((p) => connections[p.id]);
  const connectedCount = connectedProjects.length;

  // Changes count scoped to active connection (or all if no active tab)
  const changesCount = activeConnectionId
    ? changes.filter((c) => c.connectionId === activeConnectionId).length
    : changes.length;

  // Close popup on outside click
  useEffect(() => {
    if (!popupOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setPopupOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [popupOpen]);

  return (
    <footer
      className={cn(
        "h-6 flex items-center justify-between px-3",
        "bg-[var(--bg-secondary)] border-t border-[var(--border-color)]",
        "text-xs select-none shrink-0"
      )}
    >
      {/* Left section - Connection count badge + popup */}
      <div className="relative flex items-center gap-4">
        <button
          ref={buttonRef}
          onClick={() => setPopupOpen(!popupOpen)}
          className={cn(
            "flex items-center gap-1.5 px-1.5 py-0.5 -mx-1.5 rounded",
            "hover:bg-[var(--bg-tertiary)] transition-colors duration-150",
            connectedCount > 0 ? "text-[var(--success)]" : "text-[var(--text-muted)]"
          )}
        >
          <Database className="w-3 h-3" />
          <span>
            {connectedCount} {connectedCount === 1 ? "connection" : "connections"}
          </span>
          <ChevronUp className={cn(
            "w-3 h-3 transition-transform duration-150",
            !popupOpen && "rotate-180"
          )} />
        </button>

        {/* Connection popup */}
        {popupOpen && (
          <div
            ref={popupRef}
            className={cn(
              "absolute bottom-full left-0 mb-1",
              "w-64 bg-[var(--bg-primary)] border border-[var(--border-color)]",
              "rounded-lg shadow-lg overflow-hidden z-50"
            )}
          >
            <div className="px-3 py-2 border-b border-[var(--border-color)]">
              <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                Connections
              </span>
            </div>
            {connectedProjects.length === 0 ? (
              <div className="px-3 py-3 text-xs text-[var(--text-muted)] text-center">
                No active connections
              </div>
            ) : (
              <div className="py-1 max-h-48 overflow-y-auto">
                {connectedProjects.map((project) => {
                  const conn = connections[project.id];
                  if (!conn) return null;
                  const colorConfig = PROJECT_COLORS[project.color];
                  return (
                    <ConnectionPopupItem
                      key={project.id}
                      projectId={project.id}
                      projectName={project.name}
                      database={project.connection.database}
                      connectionId={conn.connectionId}
                      status={conn.status}
                      dotColor={colorConfig.dot}
                      onClose={() => setPopupOpen(false)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right section - History & Staged changes */}
      <div className="flex items-center gap-3">
        {activeConnectionId && activeProjectId && (
          <button
            onClick={() => addHistoryTab(activeConnectionId, activeProjectId)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded",
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              "hover:bg-[var(--bg-tertiary)]",
              "transition-colors duration-150"
            )}
            title="Commit History"
          >
            <History className="w-3 h-3" />
            <span>History</span>
          </button>
        )}
        {changesCount > 0 && activeConnectionId && activeProjectId && (
          <button
            onClick={() => addStagedChangesTab(activeConnectionId, activeProjectId)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded",
              "text-[var(--warning)] hover:bg-[var(--bg-tertiary)]",
              "transition-colors duration-150"
            )}
            title="View staged changes"
          >
            <FileEdit className="w-3 h-3" />
            <span>{changesCount} staged change{changesCount !== 1 ? "s" : ""}</span>
          </button>
        )}
      </div>
    </footer>
  );
}

// --- Individual connection item in the popup ---

interface ConnectionPopupItemProps {
  projectId: string;
  projectName: string;
  database: string;
  connectionId: string;
  status: string;
  dotColor: string;
  onClose: () => void;
}

function ConnectionPopupItem({
  projectId,
  projectName,
  database,
  connectionId,
  status,
  dotColor,
  onClose,
}: ConnectionPopupItemProps) {
  const disconnect = useDisconnect();

  const handleDisconnect = (e: React.MouseEvent) => {
    e.stopPropagation();
    disconnect.mutate({ projectId, connectionId });
    onClose();
  };

  const isReconnecting = status === "reconnecting";

  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-3 py-1.5",
        "hover:bg-[var(--bg-tertiary)] transition-colors duration-150"
      )}
    >
      <span className={cn("w-2 h-2 rounded-full shrink-0", dotColor)} />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-[var(--text-primary)] truncate">{projectName}</div>
        <div className="text-[10px] text-[var(--text-muted)] truncate">{database}</div>
      </div>
      {isReconnecting ? (
        <span className="text-[10px] text-[var(--warning)] shrink-0">Reconnecting...</span>
      ) : (
        <button
          onClick={handleDisconnect}
          className={cn(
            "p-0.5 rounded shrink-0",
            "text-[var(--text-muted)] hover:text-[var(--danger)]",
            "opacity-0 group-hover:opacity-100",
            "transition-all duration-150"
          )}
          title={`Disconnect from ${projectName}`}
        >
          <Unplug className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
