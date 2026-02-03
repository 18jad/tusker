import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search, ArrowRight, Table2, FolderOpen, Command } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useProjectStore } from "../../stores/projectStore";
import { cn } from "../../lib/utils";
import type { Command as CommandType } from "../../types";

type CommandCategory = CommandType["category"];

const CATEGORY_LABELS: Record<CommandCategory, string> = {
  navigation: "Navigation",
  project: "Projects",
  table: "Tables",
  query: "Query",
};

const CATEGORY_ICONS: Record<CommandCategory, React.ReactNode> = {
  navigation: <ArrowRight className="w-4 h-4" />,
  project: <FolderOpen className="w-4 h-4" />,
  table: <Table2 className="w-4 h-4" />,
  query: <Command className="w-4 h-4" />,
};

export function CommandPalette() {
  const { commandPaletteOpen, toggleCommandPalette, openProjectModal, addTab } =
    useUIStore();
  const { projects, schemas, setActiveProject } = useProjectStore();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<CommandType[]>(() => {
    const cmds: CommandType[] = [
      // Navigation commands
      {
        id: "new-project",
        label: "New Project",
        shortcut: "Ctrl+N",
        action: () => openProjectModal(),
        category: "navigation",
      },
      {
        id: "new-query",
        label: "New Query Tab",
        shortcut: "Ctrl+T",
        action: () =>
          addTab({
            id: crypto.randomUUID(),
            type: "query",
            title: "New Query",
            queryContent: "",
          }),
        category: "query",
      },
    ];

    // Add project commands
    projects.forEach((project) => {
      cmds.push({
        id: `project-${project.id}`,
        label: `Switch to ${project.name}`,
        action: () => setActiveProject(project.id),
        category: "project",
      });
      cmds.push({
        id: `edit-project-${project.id}`,
        label: `Edit ${project.name}`,
        action: () => openProjectModal(project.id),
        category: "project",
      });
    });

    // Add table commands from schemas
    schemas.forEach((schema) => {
      schema.tables.forEach((table) => {
        cmds.push({
          id: `table-${schema.name}-${table.name}`,
          label: `${schema.name}.${table.name}`,
          action: () =>
            addTab({
              id: crypto.randomUUID(),
              type: "table",
              title: table.name,
              schema: schema.name,
              table: table.name,
            }),
          category: "table",
        });
      });
    });

    return cmds;
  }, [projects, schemas, openProjectModal, addTab, setActiveProject]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;

    const lowerQuery = query.toLowerCase();
    return commands.filter((cmd) =>
      cmd.label.toLowerCase().includes(lowerQuery)
    );
  }, [commands, query]);

  const groupedCommands = useMemo(() => {
    const groups = new Map<CommandCategory, CommandType[]>();

    filteredCommands.forEach((cmd) => {
      const existing = groups.get(cmd.category) || [];
      groups.set(cmd.category, [...existing, cmd]);
    });

    return groups;
  }, [filteredCommands]);

  const flatCommands = useMemo(
    () => Array.from(groupedCommands.values()).flat(),
    [groupedCommands]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!commandPaletteOpen) {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
          e.preventDefault();
          toggleCommandPalette();
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < flatCommands.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : flatCommands.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (flatCommands[selectedIndex]) {
            flatCommands[selectedIndex].action();
            toggleCommandPalette();
          }
          break;
        case "Escape":
          e.preventDefault();
          toggleCommandPalette();
          break;
      }
    },
    [commandPaletteOpen, toggleCommandPalette, flatCommands, selectedIndex]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [commandPaletteOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (listRef.current && flatCommands.length > 0) {
      const selectedElement = listRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      selectedElement?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, flatCommands.length]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      toggleCommandPalette();
    }
  };

  const executeCommand = (command: CommandType) => {
    command.action();
    toggleCommandPalette();
  };

  if (!commandPaletteOpen) return null;

  let commandIndex = 0;

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
        aria-label="Command Palette"
        className={cn(
          "w-full max-w-xl",
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
            placeholder="Type a command or search..."
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

        {/* Commands List */}
        <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {flatCommands.length === 0 ? (
            <div className="py-8 text-center text-[var(--text-muted)]">
              No commands found
            </div>
          ) : (
            Array.from(groupedCommands.entries()).map(
              ([category, categoryCommands]) => (
                <div key={category} className="mb-2 last:mb-0">
                  <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                    {CATEGORY_ICONS[category]}
                    {CATEGORY_LABELS[category]}
                  </div>
                  {categoryCommands.map((command) => {
                    const index = commandIndex++;
                    const isSelected = index === selectedIndex;

                    return (
                      <button
                        key={command.id}
                        data-index={index}
                        onClick={() => executeCommand(command)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg",
                          "text-left text-sm transition-colors duration-75",
                          isSelected
                            ? "bg-[var(--accent)] text-white"
                            : "text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                        )}
                      >
                        <span className="truncate">{command.label}</span>
                        {command.shortcut && (
                          <kbd
                            className={cn(
                              "px-1.5 py-0.5 rounded text-xs font-mono shrink-0",
                              isSelected
                                ? "bg-white/20 text-white/80"
                                : "bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border-color)]"
                            )}
                          >
                            {command.shortcut}
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              )
            )
          )}
        </div>

        {/* Footer Hint */}
        <div className="flex items-center justify-center gap-4 px-4 py-2 border-t border-[var(--border-color)] text-xs text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <kbd className="px-1 rounded bg-[var(--bg-tertiary)]">
              <span className="text-[10px]">UP</span>
            </kbd>
            <kbd className="px-1 rounded bg-[var(--bg-tertiary)]">
              <span className="text-[10px]">DOWN</span>
            </kbd>
            <span>to navigate</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 rounded bg-[var(--bg-tertiary)]">
              <span className="text-[10px]">ENTER</span>
            </kbd>
            <span>to select</span>
          </span>
        </div>
      </div>
    </div>
  );
}
