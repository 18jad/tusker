import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Download, Upload, Loader2, Check, ArrowRight, Search } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { useProjectStore } from "../../stores/projectStore";
import { useUIStore } from "../../stores/uiStore";
import { useChangesStore } from "../../stores/changesStore";
import { useConnect, useDisconnect } from "../../hooks/useDatabase";
import { useUpdateCheck } from "../../hooks/useUpdateCheck";
import { cn, PROJECT_COLORS, modKey } from "../../lib/utils";
import appIcon from "../../assets/app-icon.png";
import type { Project } from "../../types";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function ProjectCard({ project }: { project: Project }) {
  const connectionStatus = useProjectStore((s) => s.connectionStatus);
  const { closeAllTabs, openProjectModal, openDeleteProjectModal } =
    useUIStore();
  const { clearChanges } = useChangesStore();
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const connect = useConnect();
  const disconnect = useDisconnect();

  const colorClasses = PROJECT_COLORS[project.color];
  const isConnecting = connectionStatus === "connecting";

  const handleClick = async () => {
    if (isConnecting) return;

    if (connectionStatus === "connected") {
      await disconnect.mutateAsync();
    }

    closeAllTabs();
    clearChanges();
    setActiveProject(project.id);
    connect.mutate(project.connection);
  };

  return (
    <button
      onClick={handleClick}
      disabled={isConnecting}
      className={cn(
        "group/card relative w-full text-left rounded-xl overflow-hidden",
        "bg-[var(--bg-secondary)] border border-[var(--border-color)]",
        "transition-all duration-200",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "hover:bg-[var(--bg-tertiary)] hover:border-[var(--text-muted)]/30"
      )}
    >
      <div className="flex">
        <div className={cn("w-1 shrink-0", colorClasses.dot)} />
        <div className="flex-1 min-w-0 p-4">
          {/* Top row: name + actions */}
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[15px] text-[var(--text-primary)] truncate">
                  {project.name}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-0 group-hover/card:opacity-100 transition-opacity shrink-0" />
              </div>
              <div className="mt-1.5 text-xs text-[var(--text-secondary)] truncate">
                {project.connection.host}:{project.connection.port}/{project.connection.database}
              </div>
            </div>

            {/* Hover action buttons */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity shrink-0">
              <div
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openProjectModal(project.id);
                }}
                className={cn(
                  "p-1.5 rounded-lg",
                  "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                  "hover:bg-white/10 transition-colors"
                )}
                title="Edit project"
              >
                <Pencil className="w-3.5 h-3.5" />
              </div>
              <div
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openDeleteProjectModal(project.id);
                }}
                className={cn(
                  "p-1.5 rounded-lg",
                  "text-[var(--text-muted)] hover:text-red-400",
                  "hover:bg-red-500/10 transition-colors"
                )}
                title="Delete project"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Last connected */}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-[var(--text-muted)]">
              {project.lastConnected
                ? timeAgo(project.lastConnected)
                : "Never connected"}
            </span>
            <span
              className={cn(
                "text-[11px] font-medium opacity-0 group-hover/card:opacity-100 transition-opacity",
                colorClasses.text
              )}
            >
              Connect
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function VersionBar() {
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const { status, version: updateVersion, progress, installUpdate } =
    useUpdateCheck();

  useEffect(() => {
    getVersion().then(setAppVersion);
  }, []);

  return (
    <div className="flex items-center justify-between px-6 py-3 text-[11px] text-[var(--text-muted)]">
      {/* Left: version + update */}
      <div className="flex items-center gap-3">
        {appVersion && (
          <span className="text-[var(--text-muted)]/60">v{appVersion}</span>
        )}

        {status === "available" && (
          <button
            onClick={installUpdate}
            className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded-md",
              "text-[var(--accent)] hover:bg-[var(--accent)]/10",
              "transition-colors"
            )}
          >
            <Download className="w-3 h-3" />
            Update to v{updateVersion}
          </button>
        )}

        {status === "downloading" && (
          <span className="flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            Updating... {progress}%
          </span>
        )}

        {status === "installed" && (
          <span className="flex items-center gap-1.5 text-[var(--success)]">
            <Check className="w-3 h-3" />
            Restart to apply
          </span>
        )}
      </div>

      {/* Right: shortcuts */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[10px]">
            {modKey}K
          </kbd>
          <span className="text-[var(--text-muted)]/60">Commands</span>
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[10px]">
            {modKey}P
          </kbd>
          <span className="text-[var(--text-muted)]/60">Projects</span>
        </span>
      </div>
    </div>
  );
}

export function HomePage() {
  const projects = useProjectStore((s) => s.projects);
  const openProjectModal = useUIStore((s) => s.openProjectModal);
  const openExportModal = useUIStore((s) => s.openExportModal);
  const openImportModal = useUIStore((s) => s.openImportModal);
  const openDiscoveryModal = useUIStore((s) => s.openDiscoveryModal);

  const hasProjects = projects.length > 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-2xl mx-auto px-8 pt-12 pb-6">
          {/* Greeting + header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <img
                src={appIcon}
                alt="Tusker"
                className="w-9 h-9"
                draggable={false}
              />
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                {hasProjects ? getGreeting() : "Welcome to Tusker"}
              </h1>
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              {hasProjects
                ? "Select a project to connect, or create a new one."
                : "A modern PostgreSQL client built for developers."}
            </p>
          </div>

          {/* Section header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Projects
              {hasProjects && (
                <span className="ml-2 text-[var(--text-muted)]/50 font-normal normal-case tracking-normal">
                  {projects.length}
                </span>
              )}
            </h2>

            <div className="flex items-center gap-2">
              <button
                onClick={openDiscoveryModal}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
                  "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                  "hover:bg-[var(--bg-tertiary)]",
                  "transition-colors"
                )}
              >
                <Search className="w-3.5 h-3.5" />
                Auto-Detect
              </button>
              <button
                onClick={openImportModal}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
                  "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                  "hover:bg-[var(--bg-tertiary)]",
                  "transition-colors"
                )}
              >
                <Upload className="w-3.5 h-3.5" />
                Import
              </button>
              {hasProjects && (
                <button
                  onClick={openExportModal}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
                    "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                    "hover:bg-[var(--bg-tertiary)]",
                    "transition-colors"
                  )}
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </button>
              )}
              {hasProjects && (
                <button
                  onClick={() => openProjectModal()}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
                    "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                    "bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]",
                    "border border-[var(--border-color)]",
                    "transition-colors"
                  )}
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Project
                </button>
              )}
            </div>
          </div>

          {hasProjects ? (
            /* Project grid — 2 columns */
            <div className="grid grid-cols-2 gap-3">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            /* Empty state — create first project */
            <button
              onClick={() => openProjectModal()}
              className={cn(
                "w-full flex flex-col items-center justify-center py-12 rounded-xl",
                "border border-dashed border-[var(--border-color)]",
                "hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/[0.03]",
                "transition-all duration-200 group/create"
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center mb-3",
                  "bg-[var(--accent)]/10 border border-[var(--accent)]/20",
                  "group-hover/create:bg-[var(--accent)]/15 transition-colors"
                )}
              >
                <Plus className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <span className="text-sm font-medium text-[var(--text-primary)] mb-1">
                Create your first project
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                Set up a connection to your PostgreSQL database
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom bar — version + shortcuts */}
      <div className="shrink-0 border-t border-[var(--border-color)]">
        <VersionBar />
      </div>
    </div>
  );
}
