import { useState, useEffect, useMemo } from "react";
import {
  Search,
  Plus,
  Database,
  Star,
  Plug,
  Table2,
  CirclePlus,
  Unplug,
  Download,
  Pencil,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { useProjectStore } from "../../stores/projectStore";
import { useUIStore } from "../../stores/uiStore";
import { useQueryStore } from "../../stores/queryStore";
import { useConnect } from "../../hooks/useDatabase";
import { cn, PROJECT_COLORS } from "../../lib/utils";
import type { Project } from "../../types";

// ── Helpers ──────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 172800) return "yesterday";
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return new Date(dateStr).toLocaleDateString();
}

function getConnectionHost(project: Project): string {
  const { host, port } = project.connection;
  return `${host}:${port}`;
}

// ── Stat Card ────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  subtitle,
  icon,
}: {
  label: string;
  value: string | number;
  subtitle: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex-1 flex flex-col gap-2.5 rounded p-4 px-5",
        "bg-[var(--bg-secondary)] border border-[var(--border-color)]"
      )}
    >
      <span className="text-[10px] font-medium font-mono uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-4xl font-bold font-mono leading-[0.9] text-[var(--text-primary)]">
          {value}
        </span>
        {icon}
      </div>
      <span className="text-[11px] font-medium font-mono text-[var(--text-secondary)]">
        {subtitle}
      </span>
    </div>
  );
}

// ── Connection Card ──────────────────────────────────────────────────

function ConnectionCard({
  project,
  isConnected,
  onConnect,
}: {
  project: Project;
  isConnected: boolean;
  onConnect: (project: Project) => void;
}) {
  const colorClasses = PROJECT_COLORS[project.color];

  return (
    <button
      onClick={() => onConnect(project)}
      className={cn(
        "group/card flex-1 flex flex-col gap-3 rounded p-4 px-5 text-left",
        "bg-[var(--bg-secondary)] border border-[var(--border-color)]",
        "hover:border-[var(--text-muted)]/30 hover:bg-[var(--bg-tertiary)]",
        "transition-all duration-150"
      )}
    >
      {/* Top: name + status dot */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Database className={cn("w-[18px] h-[18px]", colorClasses.text)} />
          <span className="text-[15px] font-semibold text-[var(--text-primary)]">
            {project.name}
          </span>
        </div>
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            isConnected ? "bg-[var(--success)]" : "bg-[var(--border-color)]"
          )}
        />
      </div>

      {/* Host */}
      <span className="text-[11px] font-medium font-mono text-[var(--text-secondary)]">
        {getConnectionHost(project)}/{project.connection.database}
      </span>

      {/* Bottom: badge + connect hint */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold font-mono uppercase px-2 py-0.5 rounded-sm bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
          {project.connection.ssl ? "SSL" : "PG"}
        </span>
        <span className="text-[10px] font-medium font-mono text-[var(--text-secondary)] opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center gap-1">
          Connect <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </button>
  );
}

// ── Quick Connect Item ───────────────────────────────────────────────

function QuickConnectItem({
  project,
  onConnect,
}: {
  project: Project;
  onConnect: (project: Project) => void;
}) {
  const isLocal =
    project.connection.host === "localhost" ||
    project.connection.host === "127.0.0.1";

  return (
    <button
      onClick={() => onConnect(project)}
      className={cn(
        "flex items-center gap-3 w-full rounded p-3 px-4 text-left",
        "bg-[var(--bg-secondary)] border border-[var(--border-color)]",
        "hover:border-[var(--text-muted)]/30 hover:bg-[var(--bg-tertiary)]",
        "transition-all duration-150"
      )}
    >
      <Star className="w-3.5 h-3.5 text-[var(--warning)] shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="text-xs font-semibold font-mono text-[var(--text-primary)] truncate">
          {project.name}
        </span>
        <span className="text-[10px] font-medium font-mono text-[var(--text-secondary)] truncate">
          {getConnectionHost(project)}
        </span>
      </div>
      <span className="text-[9px] font-semibold font-mono uppercase px-2 py-0.5 rounded-sm bg-[var(--bg-tertiary)] text-[var(--text-muted)] shrink-0">
        {isLocal ? "LOCAL" : "REMOTE"}
      </span>
    </button>
  );
}

// ── Activity Item ────────────────────────────────────────────────────

const ACTIVITY_ICONS: Record<string, { icon: typeof Plug; color: string }> = {
  connect: { icon: Plug, color: "text-[var(--success)]" },
  browse: { icon: Table2, color: "text-[var(--text-muted)]" },
  add: { icon: CirclePlus, color: "text-[var(--success)]" },
  disconnect: { icon: Unplug, color: "text-[var(--text-muted)]" },
  favorite: { icon: Star, color: "text-[var(--warning)]" },
  export: { icon: Download, color: "text-[var(--text-muted)]" },
  edit: { icon: Pencil, color: "text-[var(--text-muted)]" },
  delete: { icon: Trash2, color: "text-[var(--danger)]" },
};

interface ActivityEntry {
  id: string;
  type: string;
  text: string;
  time: string;
}

function ActivityItem({ activity }: { activity: ActivityEntry }) {
  const config = ACTIVITY_ICONS[activity.type] || ACTIVITY_ICONS.browse;
  const Icon = config.icon;

  return (
    <div className="flex gap-3 px-4 py-3">
      <Icon className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", config.color)} />
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <span className="text-[11px] font-medium font-mono text-[var(--text-primary)] leading-snug">
          {activity.text}
        </span>
        <span className="text-[10px] font-medium font-mono text-[var(--text-secondary)]">
          {activity.time}
        </span>
      </div>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────

export function Dashboard() {
  const projects = useProjectStore((s) => s.projects);
  const connections = useProjectStore((s) => s.connections);
  const openProjectModal = useUIStore((s) => s.openProjectModal);
  const openDiscoveryModal = useUIStore((s) => s.openDiscoveryModal);
  const queryHistory = useQueryStore((s) => s.queryHistory);
  const clearHistory = useQueryStore((s) => s.clearHistory);

  const connect = useConnect();

  const [searchQuery, setSearchQuery] = useState("");
  const [appVersion, setAppVersion] = useState<string | null>(null);

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => {});
  }, []);

  // Compute stats
  const stats = useMemo(() => {
    const local = projects.filter(
      (p) =>
        p.connection.host === "localhost" ||
        p.connection.host === "127.0.0.1"
    ).length;
    const remote = projects.length - local;

    const recentlyUsed = projects.filter((p) => {
      if (!p.lastConnected) return false;
      const diff = Date.now() - new Date(p.lastConnected).getTime();
      return diff < 7 * 24 * 60 * 60 * 1000;
    }).length;

    return { total: projects.length, local, remote, recentlyUsed };
  }, [projects]);

  // Filter projects by search
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.connection.host.toLowerCase().includes(q) ||
        p.connection.database.toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);

  // Build activity log from query history + project data
  const activities: ActivityEntry[] = useMemo(() => {
    const entries: ActivityEntry[] = [];

    for (const item of queryHistory.slice(0, 7)) {
      entries.push({
        id: item.id,
        type: item.success ? "browse" : "disconnect",
        text: item.success
          ? `Executed query (${item.rowCount ?? 0} rows)`
          : "Query failed",
        time: timeAgo(item.timestamp),
      });
    }

    if (entries.length === 0) {
      const sorted = [...projects]
        .filter((p) => p.lastConnected)
        .sort(
          (a, b) =>
            new Date(b.lastConnected!).getTime() -
            new Date(a.lastConnected!).getTime()
        );

      for (const p of sorted.slice(0, 5)) {
        entries.push({
          id: `conn-${p.id}`,
          type: "connect",
          text: `Connected to ${p.name}`,
          time: timeAgo(p.lastConnected!),
        });
      }
    }

    if (entries.length === 0) {
      entries.push({
        id: "empty",
        type: "add",
        text: "Create your first connection to get started",
        time: "just now",
      });
    }

    return entries;
  }, [queryHistory, projects]);

  // Quick connect: most recently connected projects (up to 4)
  const quickConnectProjects = useMemo(() => {
    return [...projects]
      .sort((a, b) => {
        if (!a.lastConnected && !b.lastConnected) return 0;
        if (!a.lastConnected) return 1;
        if (!b.lastConnected) return -1;
        return (
          new Date(b.lastConnected).getTime() -
          new Date(a.lastConnected).getTime()
        );
      })
      .slice(0, 4);
  }, [projects]);

  // Connection handler — uses the new multi-connection API
  const handleConnect = (project: Project) => {
    if (connect.isPending) return;
    connect.mutate({ project });
  };

  // Pair projects into rows of 2 for the grid
  const projectRows = useMemo(() => {
    const rows: Project[][] = [];
    for (let i = 0; i < filteredProjects.length; i += 2) {
      rows.push(filteredProjects.slice(i, i + 2));
    }
    return rows;
  }, [filteredProjects]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-primary)]">
      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between h-16 px-8 border-b border-[var(--border-color)] shrink-0">
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            Tusker
          </span>
          {appVersion && (
            <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded-sm bg-[var(--success)] text-[var(--bg-primary)]">
              v{appVersion}
            </span>
          )}
        </div>

        {/* Center: Search */}
        <div
          className={cn(
            "flex items-center gap-3 h-10 px-4 w-[480px] rounded",
            "border border-[var(--border-color)]",
            "focus-within:border-[var(--text-muted)]/40 transition-colors"
          )}
        >
          <Search className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="SEARCH_CONNECTIONS..."
            className="flex-1 bg-transparent text-xs font-medium font-mono text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none"
          />
        </div>

        {/* Right: New Connection */}
        <button
          onClick={() => openProjectModal()}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded",
            "bg-[var(--success)] hover:bg-[var(--success)]/90",
            "transition-colors"
          )}
        >
          <Plus className="w-3.5 h-3.5 text-[var(--bg-primary)]" />
          <span className="text-[11px] font-semibold font-mono text-[var(--bg-primary)]">
            + NEW_CONNECTION
          </span>
        </button>
      </div>

      {/* ── Content Area ────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Content */}
        <div className="flex-1 flex flex-col gap-6 p-6 px-8 overflow-y-auto">
          {/* Metrics Row */}
          <div className="flex gap-4">
            <StatCard
              label="TOTAL_CONNECTIONS"
              value={stats.total}
              subtitle={`${stats.local} local / ${stats.remote} remote`}
            />
            <StatCard
              label="FAVORITES"
              value={projects.length}
              subtitle="quick access"
              icon={<Star className="w-3.5 h-3.5 text-[var(--warning)]" />}
            />
            <StatCard
              label="RECENTLY_USED"
              value={stats.recentlyUsed}
              subtitle="last 7 days"
            />
            <StatCard
              label="TOTAL_PROJECTS"
              value={projects.length}
              subtitle="across all dbs"
            />
          </div>

          {/* Connections Section */}
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold font-mono text-[var(--text-muted)]">
                // ACTIVE_CONNECTIONS
              </span>
              <button
                onClick={openDiscoveryModal}
                className="text-[10px] font-medium font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                DISCOVER →
              </button>
            </div>

            {filteredProjects.length > 0 ? (
              <div className="flex flex-col gap-3">
                {projectRows.map((row, i) => (
                  <div key={i} className="flex gap-3">
                    {row.map((project) => (
                      <ConnectionCard
                        key={project.id}
                        project={project}
                        isConnected={!!connections[project.id]}
                        onConnect={handleConnect}
                      />
                    ))}
                    {row.length === 1 && <div className="flex-1" />}
                  </div>
                ))}
              </div>
            ) : (
              <button
                onClick={() => (searchQuery ? undefined : openProjectModal())}
                className={cn(
                  "flex flex-col items-center justify-center py-16 rounded",
                  "border border-dashed border-[var(--border-color)]",
                  !searchQuery &&
                    "hover:border-[var(--success)]/40 hover:bg-[var(--success)]/[0.03]",
                  "transition-all duration-200"
                )}
              >
                {searchQuery ? (
                  <>
                    <Search className="w-5 h-5 text-[var(--text-muted)] mb-2" />
                    <span className="text-sm font-medium font-mono text-[var(--text-secondary)]">
                      No connections match &quot;{searchQuery}&quot;
                    </span>
                  </>
                ) : (
                  <>
                    <Database className="w-5 h-5 text-[var(--text-muted)] mb-2" />
                    <span className="text-sm font-medium text-[var(--text-primary)] mb-1">
                      Create your first connection
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      Set up a connection to your PostgreSQL database
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* ── Right Panel ───────────────────────────────────────── */}
        <div className="w-[340px] flex flex-col gap-6 p-6 pr-8 overflow-y-auto shrink-0">
          {/* Quick Connect */}
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold font-mono text-[var(--text-muted)]">
                // QUICK_CONNECT
              </span>
              <button
                onClick={() => openProjectModal()}
                className="text-[10px] font-medium font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                MANAGE →
              </button>
            </div>

            {quickConnectProjects.length > 0 ? (
              quickConnectProjects.map((project) => (
                <QuickConnectItem
                  key={project.id}
                  project={project}
                  onConnect={handleConnect}
                />
              ))
            ) : (
              <div className="flex items-center justify-center py-8 rounded border border-dashed border-[var(--border-color)]">
                <span className="text-xs font-mono text-[var(--text-muted)]">
                  No connections yet
                </span>
              </div>
            )}
          </div>

          {/* Activity Log */}
          <div className="flex-1 flex flex-col gap-3.5 min-h-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold font-mono text-[var(--text-muted)]">
                // ACTIVITY_LOG
              </span>
              <button
                onClick={clearHistory}
                className="text-[10px] font-medium font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                CLEAR
              </button>
            </div>

            <div
              className={cn(
                "flex-1 flex flex-col rounded overflow-hidden",
                "bg-[var(--bg-secondary)] border border-[var(--border-color)]"
              )}
            >
              <div className="flex-1 overflow-y-auto">
                {activities.map((activity, i) => (
                  <div key={activity.id}>
                    <ActivityItem activity={activity} />
                    {i < activities.length - 1 && (
                      <div className="h-px bg-[var(--border-color)]" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
