import { Circle, Database, FileEdit, History, Loader2 } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useUIStore } from "../../stores/uiStore";
import { useChangesStore } from "../../stores/changesStore";
import { useConnect, useDisconnect } from "../../hooks/useDatabase";
import { cn } from "../../lib/utils";
import type { ConnectionStatus, Tab } from "../../types";

const CONNECTION_STATUS_CONFIG: Record<
  ConnectionStatus,
  { label: string; color: string; dotColor: string }
> = {
  disconnected: {
    label: "Disconnected",
    color: "text-[var(--text-muted)]",
    dotColor: "bg-[var(--text-muted)]",
  },
  connecting: {
    label: "Connecting...",
    color: "text-[var(--warning)]",
    dotColor: "bg-[var(--warning)]",
  },
  connected: {
    label: "Connected",
    color: "text-[var(--success)]",
    dotColor: "bg-[var(--success)]",
  },
  reconnecting: {
    label: "Reconnecting...",
    color: "text-[var(--warning)]",
    dotColor: "bg-[var(--warning)]",
  },
  error: {
    label: "Connection Error",
    color: "text-[var(--danger)]",
    dotColor: "bg-[var(--danger)]",
  },
};

function getActiveTableRowCount(
  tabs: Tab[],
  activeTabId: string | null
): number | null {
  if (!activeTabId) return null;
  const activeTab = tabs.find((t) => t.id === activeTabId);
  if (!activeTab || activeTab.type !== "table") return null;
  // Row count would come from table data in a real implementation
  // For now, return null as placeholder
  return null;
}

export function StatusBar() {
  const connectionStatus = useProjectStore((state) => state.connectionStatus);
  const error = useProjectStore((state) => state.error);
  const activeProject = useProjectStore((state) => state.getActiveProject());
  const tabs = useUIStore((state) => state.tabs);
  const activeTabId = useUIStore((state) => state.activeTabId);
  const addStagedChangesTab = useUIStore((state) => state.addStagedChangesTab);
  const changes = useChangesStore((state) => state.changes);
  const addHistoryTab = useUIStore((state) => state.addHistoryTab);

  const connect = useConnect();
  const disconnect = useDisconnect();

  const statusConfig = CONNECTION_STATUS_CONFIG[connectionStatus];
  const rowCount = getActiveTableRowCount(tabs, activeTabId);
  const changesCount = changes.length;

  const handleConnectionClick = () => {
    if (!activeProject) return;

    if (connectionStatus === "connected") {
      disconnect.mutate();
    } else if (connectionStatus === "disconnected" || connectionStatus === "error") {
      connect.mutate(activeProject.connection);
    }
  };

  const isLoading = connect.isPending || disconnect.isPending || connectionStatus === "connecting" || connectionStatus === "reconnecting";

  return (
    <footer
      className={cn(
        "h-6 flex items-center justify-between px-3",
        "bg-[var(--bg-secondary)] border-t border-[var(--border-color)]",
        "text-xs select-none shrink-0"
      )}
    >
      {/* Left section - Connection status */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleConnectionClick}
          disabled={isLoading || !activeProject}
          className={cn(
            "flex items-center gap-1.5 px-1.5 py-0.5 -mx-1.5 rounded",
            "hover:bg-[var(--bg-tertiary)] transition-colors duration-150",
            "disabled:cursor-default disabled:hover:bg-transparent",
            statusConfig.color
          )}
          title={
            connectionStatus === "connected"
              ? "Click to disconnect"
              : connectionStatus === "disconnected"
                ? "Click to connect"
                : undefined
          }
        >
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : connectionStatus === "connected" ? (
            <Circle className={cn("w-2 h-2 fill-current", statusConfig.dotColor)} />
          ) : (
            <Circle className={cn("w-2 h-2 fill-current", statusConfig.dotColor)} />
          )}
          <span>{statusConfig.label}</span>
          {activeProject && connectionStatus === "connected" && (
            <span className="text-[var(--text-muted)] ml-1">
              ({activeProject.connection.database})
            </span>
          )}
          {connectionStatus === "error" && error && (
            <span className="text-[var(--text-muted)] ml-1 truncate max-w-[200px]" title={error}>
              - {error}
            </span>
          )}
        </button>

        {rowCount !== null && (
          <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
            <Database className="w-3 h-3" />
            <span>{rowCount.toLocaleString()} rows</span>
          </div>
        )}
      </div>

      {/* Right section - History & Staged changes */}
      <div className="flex items-center gap-3">
        {connectionStatus === "connected" && (
          <button
            onClick={addHistoryTab}
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
        {changesCount > 0 && (
          <button
            onClick={addStagedChangesTab}
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
