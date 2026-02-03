import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search, Database, Plus, Loader2 } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useProjectStore } from "../../stores/projectStore";
import { useChangesStore } from "../../stores/changesStore";
import { useConnect, useDisconnect } from "../../hooks/useDatabase";
import { cn, PROJECT_COLORS } from "../../lib/utils";
import type { Project } from "../../types";

export function ProjectSpotlight() {
  const { projectSpotlightOpen, closeProjectSpotlight, openProjectModal, closeAllTabs } =
    useUIStore();
  const { projects, activeProjectId, connectionStatus, setActiveProject } =
    useProjectStore();
  const { clearChanges } = useChangesStore();

  const connect = useConnect();
  const disconnect = useDisconnect();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredProjects = useMemo(() => {
    if (!query.trim()) return projects;

    const lowerQuery = query.toLowerCase();
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(lowerQuery) ||
        project.connection.host.toLowerCase().includes(lowerQuery) ||
        project.connection.database.toLowerCase().includes(lowerQuery)
    );
  }, [projects, query]);

  const handleSelectProject = useCallback(
    async (project: Project) => {
      // Disconnect from current if connected
      if (connectionStatus === "connected") {
        await disconnect.mutateAsync();
      }

      // Clear tabs and staged changes from previous project
      closeAllTabs();
      clearChanges();

      setActiveProject(project.id);

      // Auto-connect to the selected project
      connect.mutate(project.connection);

      closeProjectSpotlight();
    },
    [
      connectionStatus,
      disconnect,
      closeAllTabs,
      clearChanges,
      setActiveProject,
      connect,
      closeProjectSpotlight,
    ]
  );

  const handleCreateProject = useCallback(() => {
    openProjectModal();
    closeProjectSpotlight();
  }, [openProjectModal, closeProjectSpotlight]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!projectSpotlightOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredProjects.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredProjects.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (filteredProjects[selectedIndex]) {
            handleSelectProject(filteredProjects[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          closeProjectSpotlight();
          break;
      }
    },
    [
      projectSpotlightOpen,
      closeProjectSpotlight,
      filteredProjects,
      selectedIndex,
      handleSelectProject,
    ]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (projectSpotlightOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [projectSpotlightOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (listRef.current && filteredProjects.length > 0) {
      const selectedElement = listRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      selectedElement?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, filteredProjects.length]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      closeProjectSpotlight();
    }
  };

  if (!projectSpotlightOpen) return null;

  const isConnecting = connectionStatus === "connecting";

  return (
    <div
      onClick={handleOverlayClick}
      className={cn(
        "fixed inset-0 z-50 flex items-start justify-center pt-[20vh]",
        "bg-black/60 backdrop-blur-sm",
        "animate-in fade-in duration-150"
      )}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Project Selector"
        className={cn(
          "w-full max-w-md",
          "bg-[var(--bg-secondary)] border border-[var(--border-color)]",
          "rounded-xl shadow-2xl shadow-black/40 overflow-hidden",
          "animate-in zoom-in-95 slide-in-from-top-4 duration-200"
        )}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-color)]">
          <Search className="w-5 h-5 text-[var(--text-muted)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects..."
            className={cn(
              "flex-1 bg-transparent text-[var(--text-primary)]",
              "placeholder:text-[var(--text-muted)]",
              "outline-none"
            )}
          />
          <kbd className="px-2 py-0.5 rounded text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
            ESC
          </kbd>
        </div>

        {/* Projects List */}
        <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {filteredProjects.length === 0 && query.trim() ? (
            <div className="py-8 text-center text-[var(--text-muted)]">
              No projects found
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="py-8 text-center text-[var(--text-muted)]">
              <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No projects yet</p>
              <p className="text-xs mt-1">Create your first project to get started</p>
            </div>
          ) : (
            filteredProjects.map((project, index) => {
              const isSelected = index === selectedIndex;
              const isActive = project.id === activeProjectId;
              const colorClasses = PROJECT_COLORS[project.color];

              return (
                <button
                  key={project.id}
                  data-index={index}
                  onClick={() => handleSelectProject(project)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  disabled={isConnecting}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg",
                    "text-left transition-colors duration-75",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    isSelected
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                  )}
                >
                  {/* Color indicator */}
                  <div
                    className={cn(
                      "w-2.5 h-2.5 rounded-full flex-shrink-0",
                      colorClasses.bg
                    )}
                  />

                  {/* Project info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{project.name}</span>
                      {isActive && (
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded",
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-[var(--accent)]/20 text-[var(--accent)]"
                          )}
                        >
                          Active
                        </span>
                      )}
                    </div>
                    <div
                      className={cn(
                        "text-xs truncate",
                        isSelected ? "text-white/70" : "text-[var(--text-muted)]"
                      )}
                    >
                      {project.connection.host}:{project.connection.port}/
                      {project.connection.database}
                    </div>
                  </div>

                  {/* Loading indicator when connecting */}
                  {isConnecting && isActive && (
                    <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer with New Project button */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--border-color)]">
          <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <kbd className="px-1 rounded bg-[var(--bg-tertiary)]">
                <span className="text-[10px]">↑↓</span>
              </kbd>
              <span>navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 rounded bg-[var(--bg-tertiary)]">
                <span className="text-[10px]">↵</span>
              </kbd>
              <span>connect</span>
            </span>
          </div>

          <button
            onClick={handleCreateProject}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs",
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              "hover:bg-[var(--bg-tertiary)] transition-colors"
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Project</span>
          </button>
        </div>
      </div>
    </div>
  );
}
