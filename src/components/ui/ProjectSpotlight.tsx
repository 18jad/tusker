import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search, Database, Plus, Loader2, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useProjectStore } from "../../stores/projectStore";
import { useConnect } from "../../hooks/useDatabase";
import { cn, PROJECT_COLORS } from "../../lib/utils";
import type { Project } from "../../types";

export function ProjectSpotlight() {
  const { projectSpotlightOpen, closeProjectSpotlight, openProjectModal } =
    useUIStore();
  const projects = useProjectStore((s) => s.projects);
  const connections = useProjectStore((s) => s.connections);

  const connect = useConnect();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
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
    (project: Project) => {
      const isConnected = useProjectStore.getState().isProjectConnected(project.id);
      if (isConnected) {
        // Already connected — just close the spotlight
        closeProjectSpotlight();
        return;
      }
      // Connect alongside existing connections
      connect.mutate({ project });
      closeProjectSpotlight();
    },
    [connect, closeProjectSpotlight]
  );

  const handleCreateProject = useCallback(() => {
    openProjectModal();
    closeProjectSpotlight();
  }, [openProjectModal, closeProjectSpotlight]);

  const handleEditProject = useCallback(
    (e: React.MouseEvent, projectId: string) => {
      e.stopPropagation();
      openProjectModal(projectId);
      closeProjectSpotlight();
    },
    [openProjectModal, closeProjectSpotlight]
  );

  const handleDeleteProject = useCallback(
    (projectId: string) => {
      setConfirmDeleteId(null);
      closeProjectSpotlight();
      useUIStore.getState().openDeleteProjectModal(projectId);
    },
    [closeProjectSpotlight]
  );

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
      setConfirmDeleteId(null);
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

  return (
    <div
      onClick={handleOverlayClick}
      className={cn(
        "fixed inset-0 z-50 flex items-start justify-center pt-[20vh]",
        "bg-black/60 transition-all duration-150",
        projectSpotlightOpen
          ? "opacity-100 pointer-events-auto backdrop-blur-sm"
          : "opacity-0 pointer-events-none"
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
          "transition-all duration-150",
          projectSpotlightOpen
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 -translate-y-2"
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
              "!outline-none focus:!outline-none focus-visible:!outline-none",
              "!ring-0 focus:!ring-0 !border-none focus:!border-none"
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
              const isConnected = !!connections[project.id];
              const isConnecting = connections[project.id]?.status === "connecting";
              const colorClasses = PROJECT_COLORS[project.color];
              const isConfirmingDelete = confirmDeleteId === project.id;

              if (isConfirmingDelete) {
                return (
                  <div
                    key={project.id}
                    data-index={index}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20"
                  >
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span className="flex-1 text-sm text-[var(--text-primary)] truncate">
                      Delete <span className="font-medium">"{project.name}"</span>?
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleDeleteProject(project.id)}
                        className={cn(
                          "px-2.5 py-1 text-xs rounded-md",
                          "bg-red-500 text-white hover:bg-red-600",
                          "transition-colors"
                        )}
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className={cn(
                          "px-2.5 py-1 text-xs rounded-md",
                          "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                          "hover:bg-[var(--bg-tertiary)] transition-colors"
                        )}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={project.id}
                  data-index={index}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    "group/project w-full flex items-center gap-3 px-3 py-2.5 rounded-lg",
                    "text-left transition-all duration-75",
                    isConnecting && "opacity-50 cursor-not-allowed",
                    isSelected
                      ? "bg-[var(--bg-tertiary)]"
                      : "text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/50"
                  )}
                >
                  {/* Clickable area for selecting */}
                  <button
                    onClick={() => handleSelectProject(project)}
                    disabled={isConnecting}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    {/* Color indicator */}
                    <div className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
                      <div
                        className={cn(
                          "rounded-full transition-all ring-2",
                          colorClasses.dot,
                          isSelected
                            ? "w-3.5 h-3.5 ring-white/20"
                            : "w-2.5 h-2.5 ring-transparent"
                        )}
                      />
                    </div>

                    {/* Project info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{project.name}</span>
                        {isConnected && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                            Connected
                          </span>
                        )}
                      </div>
                      <div className="text-xs truncate text-[var(--text-muted)]">
                        {project.connection.host}:{project.connection.port}/
                        {project.connection.database}
                      </div>
                    </div>
                  </button>

                  {/* Action buttons (visible on hover) */}
                  {isConnecting ? (
                    <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                  ) : (
                    <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover/project:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleEditProject(e, project.id)}
                        className={cn(
                          "p-1.5 rounded-md",
                          "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                          "hover:bg-[var(--bg-secondary)] transition-colors"
                        )}
                        title="Edit project"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(project.id);
                        }}
                        className={cn(
                          "p-1.5 rounded-md",
                          "text-[var(--text-muted)] hover:text-red-400",
                          "hover:bg-red-500/10 transition-colors"
                        )}
                        title="Delete project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
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
