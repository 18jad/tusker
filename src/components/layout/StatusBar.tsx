import { useState, useRef, useEffect, useMemo } from "react";
import { Database, FileEdit, History, Unplug, ChevronUp } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useUIStore } from "../../stores/uiStore";
import { useChangesStore } from "../../stores/changesStore";
import { useDisconnect } from "../../hooks/useDatabase";
import { cn, PROJECT_COLORS } from "../../lib/utils";

type OpenPopup = null | "connections" | "changes";

export function StatusBar() {
  const projects = useProjectStore((state) => state.projects);
  const connections = useProjectStore((state) => state.connections);
  const addStagedChangesTab = useUIStore((state) => state.addStagedChangesTab);
  const addHistoryTab = useUIStore((state) => state.addHistoryTab);
  const changes = useChangesStore((state) => state.changes);

  const [openPopup, setOpenPopup] = useState<OpenPopup>(null);
  const connPopupRef = useRef<HTMLDivElement>(null);
  const connButtonRef = useRef<HTMLButtonElement>(null);
  const changesPopupRef = useRef<HTMLDivElement>(null);
  const changesButtonRef = useRef<HTMLButtonElement>(null);

  // Connected projects list
  const connectedProjects = projects.filter((p) => connections[p.id]);
  const connectedCount = connectedProjects.length;

  // Total staged changes across ALL connections
  const totalChangesCount = changes.length;

  // Per-connection change counts
  const changesByConnection = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of changes) {
      map[c.connectionId] = (map[c.connectionId] || 0) + 1;
    }
    return map;
  }, [changes]);

  // Close popups on outside click
  useEffect(() => {
    if (!openPopup) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (openPopup === "connections") {
        if (
          connPopupRef.current && !connPopupRef.current.contains(target) &&
          connButtonRef.current && !connButtonRef.current.contains(target)
        ) {
          setOpenPopup(null);
        }
      } else if (openPopup === "changes") {
        if (
          changesPopupRef.current && !changesPopupRef.current.contains(target) &&
          changesButtonRef.current && !changesButtonRef.current.contains(target)
        ) {
          setOpenPopup(null);
        }
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openPopup]);

  const togglePopup = (popup: "connections" | "changes") => {
    setOpenPopup((prev) => (prev === popup ? null : popup));
  };

  return (
    <footer
      className={cn(
        "h-6 flex items-center justify-between px-3",
        "bg-[var(--bg-secondary)] border-t border-[var(--border-color)]",
        "text-xs font-mono select-none shrink-0"
      )}
    >
      {/* Left section - Connection count badge + popup */}
      <div className="relative flex items-center gap-3">
        <button
          ref={connButtonRef}
          onClick={() => togglePopup("connections")}
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
            openPopup !== "connections" && "rotate-180"
          )} />
        </button>

        {/* Connections popup */}
        {openPopup === "connections" && (
          <div
            ref={connPopupRef}
            className={cn(
              "absolute bottom-full left-0 mb-1",
              "w-64 bg-[var(--bg-primary)] border border-[var(--border-color)]",
              "rounded-[4px] shadow-lg overflow-hidden z-50"
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
                      onClose={() => setOpenPopup(null)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right section - Staged changes badge + popup */}
      <div className="relative flex items-center gap-3">
        <button
          ref={changesButtonRef}
          onClick={() => togglePopup("changes")}
          className={cn(
            "flex items-center gap-1.5 px-1.5 py-0.5 -mr-1.5 rounded",
            "hover:bg-[var(--bg-tertiary)] transition-colors duration-150",
            totalChangesCount > 0 ? "text-[var(--warning)]" : "text-[var(--text-muted)]"
          )}
        >
          <FileEdit className="w-3 h-3" />
          <span>
            {totalChangesCount > 0
              ? `${totalChangesCount} change${totalChangesCount !== 1 ? "s" : ""}`
              : "No changes"}
          </span>
          <ChevronUp className={cn(
            "w-3 h-3 transition-transform duration-150",
            openPopup !== "changes" && "rotate-180"
          )} />
        </button>

        {/* Staged changes popup */}
        {openPopup === "changes" && (
          <div
            ref={changesPopupRef}
            className={cn(
              "absolute bottom-full right-0 mb-1",
              "w-72 bg-[var(--bg-primary)] border border-[var(--border-color)]",
              "rounded-[4px] shadow-lg overflow-hidden z-50"
            )}
          >
            <div className="px-3 py-2 border-b border-[var(--border-color)]">
              <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                Staged Changes
              </span>
            </div>
            {totalChangesCount === 0 ? (
              <div className="px-3 py-3 text-xs text-[var(--text-muted)] text-center">
                No staged changes
              </div>
            ) : (
              <div className="py-1 max-h-64 overflow-y-auto">
                {connectedProjects.map((project) => {
                  const conn = connections[project.id];
                  if (!conn) return null;
                  const count = changesByConnection[conn.connectionId] || 0;
                  if (count === 0) return null;
                  const colorConfig = PROJECT_COLORS[project.color];
                  return (
                    <ChangesPopupItem
                      key={project.id}
                      projectId={project.id}
                      projectName={project.name}
                      database={project.connection.database}
                      connectionId={conn.connectionId}
                      dotColor={colorConfig.dot}
                      changesCount={count}
                      onOpenChanges={() => {
                        addStagedChangesTab(conn.connectionId, project.id);
                        setOpenPopup(null);
                      }}
                      onOpenHistory={() => {
                        addHistoryTab(conn.connectionId, project.id);
                        setOpenPopup(null);
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </footer>
  );
}

// --- Connection popup item (clean: name + disconnect) ---

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

// --- Staged changes popup item (per-connection change summary) ---

interface ChangesPopupItemProps {
  projectId: string;
  projectName: string;
  database: string;
  connectionId: string;
  dotColor: string;
  changesCount: number;
  onOpenChanges: () => void;
  onOpenHistory: () => void;
}

function ChangesPopupItem({
  projectName,
  database,
  dotColor,
  changesCount,
  onOpenChanges,
  onOpenHistory,
}: ChangesPopupItemProps) {
  return (
    <div
      className={cn(
        "group px-3 py-2",
        "hover:bg-[var(--bg-tertiary)] transition-colors duration-150"
      )}
    >
      {/* Connection info + change count */}
      <div className="flex items-center gap-2">
        <span className={cn("w-2 h-2 rounded-full shrink-0", dotColor)} />
        <div className="flex-1 min-w-0">
          <span className="text-xs text-[var(--text-primary)]">{projectName}</span>
          <span className="text-[10px] text-[var(--text-muted)] ml-1.5">{database}</span>
        </div>
        <span className="text-[11px] font-medium text-[var(--warning)] tabular-nums shrink-0">
          {changesCount}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-2 ml-4">
        <button
          onClick={onOpenChanges}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-[11px] font-mono font-medium",
            "bg-amber-500/15 text-[var(--warning)] border border-amber-500/25",
            "hover:bg-amber-500/25 active:bg-amber-500/30",
            "transition-colors duration-150"
          )}
        >
          <FileEdit className="w-3 h-3" />
          <span>View Changes</span>
        </button>
        <button
          onClick={onOpenHistory}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-[11px] font-mono font-medium",
            "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-color)]",
            "hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]",
            "active:bg-[var(--bg-tertiary)]",
            "transition-colors duration-150"
          )}
        >
          <History className="w-3 h-3" />
          <span>History</span>
        </button>
      </div>
    </div>
  );
}
