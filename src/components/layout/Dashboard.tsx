import { useState, useEffect, useMemo, useRef } from "react";
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
  ChevronDown,
  ArrowRight,
  X,
} from "lucide-react";
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
        "flex-1 flex flex-col gap-[10px] rounded-[4px] py-4 px-5",
        "bg-[var(--bg-secondary)] border border-[var(--border-color)]"
      )}
    >
      <span className="text-[10px] font-medium font-mono uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-[36px] font-bold font-mono leading-[0.9] text-[var(--text-primary)]">
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
  const updateProject = useProjectStore((s) => s.updateProject);
  const openProjectModal = useUIStore((s) => s.openProjectModal);

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateProject(project.id, { favorite: !project.favorite });
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    openProjectModal(project.id);
  };

  return (
    <button
      onClick={() => onConnect(project)}
      className={cn(
        "group/card flex flex-col rounded-[4px] py-4 px-5 text-left",
        "bg-[var(--bg-secondary)] border",
        isConnected
          ? "border-[var(--success)]/40 hover:border-[var(--success)]/60"
          : "border-[var(--border-color)] hover:border-[var(--text-muted)]/30",
        "hover:bg-[var(--bg-tertiary)]",
        "transition-all duration-150"
      )}
    >
      {/* Top: icon + name | status dot */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[10px]">
          <Database className={cn("w-[18px] h-[18px]", colorClasses.text)} />
          <span className="text-[15px] font-semibold font-heading text-[var(--text-primary)]">
            {project.name}
          </span>
        </div>
        {isConnected ? (
          <span className="text-[9px] font-bold font-mono uppercase px-2 py-[2px] rounded-[2px] bg-[var(--success)]/15 text-[var(--success)]">
            CONNECTED
          </span>
        ) : (
          <div className="w-2 h-2 rounded-full shrink-0 bg-[var(--border-color)]" />
        )}
      </div>

      {/* Host */}
      <span className="text-[11px] font-medium font-mono text-[var(--text-secondary)] mt-3 line-clamp-2 break-all">
        {getConnectionHost(project)}
      </span>

      {/* Bottom: badge + actions */}
      <div className="flex items-center justify-between mt-auto pt-3">
        <span className="text-[9px] font-semibold font-mono uppercase px-2 py-[3px] rounded-[2px] bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
          {project.connection.ssl ? "SSL" : "PG"}
        </span>
        <div className="flex items-center gap-0.5">
          <div
            role="button"
            onClick={handleEdit}
            className={cn(
              "p-1 rounded transition-all duration-150",
              "text-[var(--text-muted)] opacity-0 group-hover/card:opacity-100",
              "hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
            )}
            title="Edit connection"
          >
            <Pencil className="w-3.5 h-3.5" />
          </div>
          <div
            role="button"
            onClick={handleToggleFavorite}
            className={cn(
              "p-1 rounded transition-all duration-150",
              project.favorite
                ? "text-[var(--warning)] hover:bg-[var(--warning)]/15"
                : "text-[var(--text-muted)] opacity-0 group-hover/card:opacity-100 hover:text-[var(--warning)] hover:bg-[var(--warning)]/10"
            )}
            title={project.favorite ? "Remove from Quick Connect" : "Add to Quick Connect"}
          >
            <Star
              className="w-3.5 h-3.5"
              fill={project.favorite ? "currentColor" : "none"}
            />
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Quick Connect Item ───────────────────────────────────────────────

function QuickConnectItem({
  project,
  isConnected,
  onConnect,
}: {
  project: Project;
  isConnected: boolean;
  onConnect: (project: Project) => void;
}) {
  const isLocal =
    project.connection.host === "localhost" ||
    project.connection.host === "127.0.0.1";

  return (
    <button
      onClick={() => onConnect(project)}
      className={cn(
        "group/qc flex items-center gap-3 w-full rounded-[4px] py-3 px-4 text-left",
        "bg-[var(--bg-secondary)] border",
        isConnected
          ? "border-[var(--success)]/40 hover:border-[var(--success)]/60"
          : "border-[var(--border-color)] hover:border-[var(--text-muted)]/30",
        "hover:bg-[var(--bg-tertiary)]",
        "transition-all duration-150"
      )}
    >
      <Star className="w-3.5 h-3.5 text-[var(--warning)] shrink-0" fill="currentColor" />
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="text-xs font-semibold font-mono text-[var(--text-primary)] truncate">
          {project.name}
        </span>
        <span className="text-[10px] font-medium font-mono text-[var(--text-secondary)] truncate">
          {getConnectionHost(project)}
        </span>
      </div>
      {isConnected ? (
        <span className="text-[9px] font-bold font-mono uppercase px-2 py-[2px] rounded-[2px] bg-[var(--success)]/15 text-[var(--success)] shrink-0 group-hover/qc:hidden">
          LIVE
        </span>
      ) : (
        <span className="text-[9px] font-semibold font-mono uppercase px-2 py-[3px] rounded-[2px] bg-[var(--bg-tertiary)] text-[var(--text-muted)] shrink-0 group-hover/qc:hidden">
          {isLocal ? "LOCAL" : "REMOTE"}
        </span>
      )}
      <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 hidden group-hover/qc:block" />
    </button>
  );
}

// ── Quick Connect Section (with manage popover) ─────────────────────

function QuickConnectSection({
  projects,
  quickConnectProjects,
  favoritesCount,
  connections,
  onConnect,
}: {
  projects: Project[];
  quickConnectProjects: Project[];
  favoritesCount: number;
  connections: Record<string, unknown>;
  onConnect: (project: Project) => void;
}) {
  const [showManage, setShowManage] = useState(false);
  const [manageSearch, setManageSearch] = useState("");
  const [expanded, setExpanded] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const updateProject = useProjectStore((s) => s.updateProject);

  // Close on outside click
  useEffect(() => {
    if (!showManage) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current && !popoverRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        setShowManage(false);
        setManageSearch("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showManage]);

  // Filter projects in manage popover
  const manageProjects = useMemo(() => {
    if (!manageSearch.trim()) return projects;
    const q = manageSearch.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.connection.host.toLowerCase().includes(q) ||
        p.connection.database.toLowerCase().includes(q)
    );
  }, [projects, manageSearch]);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="relative flex items-center justify-between">
        <span className="text-[11px] font-semibold font-mono text-[var(--text-muted)]">
          // Quick Connect
        </span>
        <button
          ref={buttonRef}
          onClick={() => {
            setShowManage((v) => !v);
            if (showManage) setManageSearch("");
          }}
          className="flex items-center gap-1 text-[10px] font-medium font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          MANAGE
          <ChevronDown className={cn(
            "w-3 h-3 transition-transform duration-150",
            showManage && "rotate-180"
          )} />
        </button>

        {/* Manage popover */}
        {showManage && (
          <div
            ref={popoverRef}
            className={cn(
              "absolute top-full right-0 mt-2 z-50",
              "w-72 bg-[var(--bg-primary)] border border-[var(--border-color)]",
              "rounded-[4px] shadow-lg overflow-hidden"
            )}
          >
            <div className="px-3 py-2 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <Search className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                <input
                  type="text"
                  value={manageSearch}
                  onChange={(e) => setManageSearch(e.target.value)}
                  placeholder="Search connections..."
                  className="flex-1 bg-transparent text-[11px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                  autoFocus
                />
                <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
                  {favoritesCount} starred
                </span>
              </div>
            </div>
            <div className="py-1 max-h-64 overflow-y-auto">
              {manageProjects.length === 0 ? (
                <div className="px-3 py-3 text-[11px] font-mono text-[var(--text-muted)] text-center">
                  No matches
                </div>
              ) : (
              manageProjects.map((project) => {
                const isFav = !!project.favorite;
                return (
                  <div
                    key={project.id}
                    role="button"
                    onClick={() => updateProject(project.id, { favorite: !isFav })}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 cursor-pointer",
                      "hover:bg-[var(--bg-tertiary)] transition-colors duration-150"
                    )}
                  >
                    <Star
                      className={cn(
                        "w-3.5 h-3.5 shrink-0",
                        isFav ? "text-[var(--warning)]" : "text-[var(--text-muted)]/40"
                      )}
                      fill={isFav ? "currentColor" : "none"}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium font-mono text-[var(--text-primary)] truncate">
                        {project.name}
                      </div>
                      <div className="text-[10px] font-mono text-[var(--text-secondary)] truncate">
                        {getConnectionHost(project)}
                      </div>
                    </div>
                  </div>
                );
              })
              )}
            </div>
          </div>
        )}
      </div>

      {quickConnectProjects.length > 0 ? (
        <>
          {(expanded ? quickConnectProjects : quickConnectProjects.slice(0, 5)).map((project) => (
            <QuickConnectItem
              key={project.id}
              project={project}
              isConnected={!!connections[project.id]}
              onConnect={onConnect}
            />
          ))}
          {quickConnectProjects.length > 5 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-[10px] font-medium font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors py-1"
            >
              {expanded ? "Show less" : `+${quickConnectProjects.length - 5} more`}
            </button>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-1.5 py-8 rounded-[4px] border border-dashed border-[var(--border-color)]">
          <Star className="w-4 h-4 text-[var(--text-muted)]/40" />
          <span className="text-xs font-mono text-[var(--text-muted)]">
            Star a connection to pin it here
          </span>
        </div>
      )}
    </div>
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
      <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
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
  const setShowDashboard = useUIStore((s) => s.setShowDashboard);
  const queryHistory = useQueryStore((s) => s.queryHistory);
  const clearHistory = useQueryStore((s) => s.clearHistory);

  const connect = useConnect();

  const [searchQuery, setSearchQuery] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const filterInputRef = useRef<HTMLInputElement>(null);

  // Focus filter input when shown
  useEffect(() => {
    if (showFilter) {
      filterInputRef.current?.focus();
    }
  }, [showFilter]);

  // "/" shortcut to open filter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "/") {
        e.preventDefault();
        setShowFilter(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
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

  // All favorited projects
  const allFavorites = useMemo(() => {
    return projects.filter((p) => p.favorite);
  }, [projects]);

  const quickConnectProjects = allFavorites;
  const favoritesCount = allFavorites.length;

  // Connection handler
  const handleConnect = (project: Project) => {
    if (connections[project.id]) {
      setShowDashboard(false);
      return;
    }
    if (connect.isPending) return;
    connect.mutate({ project }, {
      onSuccess: () => setShowDashboard(false),
    });
  };

  const handleCloseFilter = () => {
    setShowFilter(false);
    setSearchQuery("");
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-primary)]">
      {/* ── Content Area ────────────────────────────────────────── */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Left Content */}
        <div className="flex-1 flex flex-col gap-6 p-6 px-8 overflow-y-auto">
          {/* Metrics Row */}
          <div className="flex gap-4">
            <StatCard
              label="Total Connections"
              value={stats.total}
              subtitle={`${stats.local} local / ${stats.remote} remote`}
            />
            <StatCard
              label="FAVORITES"
              value={favoritesCount}
              subtitle="quick access"
              icon={<Star className="w-3.5 h-3.5 text-[var(--warning)]" />}
            />
            <StatCard
              label="Recently Used"
              value={stats.recentlyUsed}
              subtitle="last 7 days"
            />
            <StatCard
              label="Total Projects"
              value={projects.length}
              subtitle="across all dbs"
            />
          </div>

          {/* Connections Section */}
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold font-mono text-[var(--text-muted)]">
                // Active Connections
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFilter((v) => !v)}
                  className={cn(
                    "p-1.5 rounded transition-colors duration-150",
                    showFilter
                      ? "text-[var(--accent)] bg-[var(--accent)]/10"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                  )}
                  title="Filter connections (/)"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => openProjectModal()}
                  className={cn(
                    "p-1.5 rounded transition-colors duration-150",
                    "text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10"
                  )}
                  title="New connection"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Inline Filter */}
            {showFilter && (
              <div
                className={cn(
                  "flex items-center gap-3 h-9 px-3 rounded-[4px]",
                  "bg-[var(--bg-secondary)] border border-[var(--border-color)]",
                  "focus-within:border-[var(--text-muted)]/40 transition-colors"
                )}
              >
                <Search className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                <input
                  ref={filterInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") handleCloseFilter();
                  }}
                  placeholder="Filter connections..."
                  className="flex-1 bg-transparent text-xs font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                />
                <button
                  onClick={handleCloseFilter}
                  className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {filteredProjects.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {filteredProjects.map((project) => (
                  <ConnectionCard
                    key={project.id}
                    project={project}
                    isConnected={!!connections[project.id]}
                    onConnect={handleConnect}
                  />
                ))}
              </div>
            ) : (
              <button
                onClick={() => (searchQuery ? undefined : openProjectModal())}
                className={cn(
                  "flex flex-col items-center justify-center py-16 rounded-[4px]",
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
                    <span className="text-sm font-medium font-heading text-[var(--text-primary)] mb-1">
                      Create your first connection
                    </span>
                    <span className="text-xs font-mono text-[var(--text-muted)]">
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
          <QuickConnectSection
            projects={projects}
            quickConnectProjects={quickConnectProjects}
            favoritesCount={favoritesCount}
            connections={connections}
            onConnect={handleConnect}
          />

          {/* Activity Log */}
          <div className="flex-1 flex flex-col gap-3.5 min-h-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold font-mono text-[var(--text-muted)]">
                // Activity Log
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
                "flex-1 flex flex-col rounded-[4px] overflow-hidden",
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
