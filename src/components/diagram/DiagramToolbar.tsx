import { useState, useRef, useEffect } from "react";
import {
  Search,
  RotateCcw,
  Maximize2,
  Camera,
  ChevronDown,
  Check,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface DiagramToolbarProps {
  schemaNames: string[];
  visibleSchemas: Set<string>;
  onToggleSchema: (schema: string) => void;
  onShowAllSchemas: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onResetLayout: () => void;
  onFitView: () => void;
  onExportPng: () => void;
}

export function DiagramToolbar({
  schemaNames,
  visibleSchemas,
  onToggleSchema,
  onShowAllSchemas,
  searchQuery,
  onSearchChange,
  onResetLayout,
  onFitView,
  onExportPng,
}: DiagramToolbarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    if (filterOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [filterOpen]);

  const allVisible = visibleSchemas.size === schemaNames.length;

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search tables..."
          className={cn(
            "w-full pl-8 pr-8 py-1.5 rounded-lg text-xs",
            "bg-[var(--bg-primary)] border border-[var(--border-color)]",
            "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
            "focus:outline-none focus:border-[var(--accent)]/50",
          )}
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Schema filter dropdown */}
      {schemaNames.length > 1 && (
        <div ref={filterRef} className="relative">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs",
              "border border-[var(--border-color)]",
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              "hover:bg-[var(--bg-tertiary)] transition-colors",
              !allVisible && "border-[var(--accent)]/40 text-[var(--accent)]",
            )}
          >
            Schema: {allVisible ? "All" : `${visibleSchemas.size}/${schemaNames.length}`}
            <ChevronDown className="w-3 h-3" />
          </button>
          {filterOpen && (
            <div className="absolute top-full mt-1 right-0 z-50 w-48 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl py-1">
              <button
                onClick={onShowAllSchemas}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left",
                  "hover:bg-[var(--bg-tertiary)] transition-colors",
                  allVisible ? "text-[var(--accent)]" : "text-[var(--text-secondary)]",
                )}
              >
                <Check className={cn("w-3 h-3", allVisible ? "opacity-100" : "opacity-0")} />
                Show All
              </button>
              <div className="h-px bg-[var(--border-color)] my-1" />
              {schemaNames.map((name) => (
                <button
                  key={name}
                  onClick={() => onToggleSchema(name)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left",
                    "hover:bg-[var(--bg-tertiary)] transition-colors",
                    visibleSchemas.has(name) ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]",
                  )}
                >
                  <Check className={cn("w-3 h-3", visibleSchemas.has(name) ? "opacity-100" : "opacity-0")} />
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1" />

      <button
        onClick={onResetLayout}
        title="Reset layout"
        className={cn(
          "p-1.5 rounded-lg text-[var(--text-muted)]",
          "hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]",
          "transition-colors",
        )}
      >
        <RotateCcw className="w-4 h-4" />
      </button>
      <button
        onClick={onFitView}
        title="Fit to view"
        className={cn(
          "p-1.5 rounded-lg text-[var(--text-muted)]",
          "hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]",
          "transition-colors",
        )}
      >
        <Maximize2 className="w-4 h-4" />
      </button>
      <button
        onClick={onExportPng}
        title="Export as PNG"
        className={cn(
          "p-1.5 rounded-lg text-[var(--text-muted)]",
          "hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]",
          "transition-colors",
        )}
      >
        <Camera className="w-4 h-4" />
      </button>
    </div>
  );
}
