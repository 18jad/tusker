import {
  Play,
  PlaySquare,
  Sparkles,
  Save,
  FolderOpen,
  History,
  Loader2,
} from "lucide-react";
import { cn, modKey } from "../../lib/utils";
import { Tooltip } from "../ui/Tooltip";

interface QueryToolbarProps {
  onExecute: () => void;
  onExecuteSelection: () => void;
  onFormat: () => void;
  onSave: () => void;
  onToggleSavedQueries: () => void;
  onToggleHistory: () => void;
  isExecuting: boolean;
  hasSelection: boolean;
  showSavedQueries: boolean;
  showHistory: boolean;
}

export function QueryToolbar({
  onExecute,
  onExecuteSelection,
  onFormat,
  onSave,
  onToggleSavedQueries,
  onToggleHistory,
  isExecuting,
  showSavedQueries,
  showHistory,
}: QueryToolbarProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] shrink-0">
      {/* Left side - Execute buttons */}
      <div className="flex items-center gap-2">
        <Tooltip content="Run the entire query" shortcut={`${modKey}+Enter`}>
          <button
            onClick={onExecute}
            disabled={isExecuting}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium",
              "bg-green-600 hover:bg-green-500 text-white",
              "transition-colors duration-150",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isExecuting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span>Execute</span>
            <kbd className="text-green-200/70 text-xs ml-1 hidden sm:inline">{modKey}+↵</kbd>
          </button>
        </Tooltip>

        <Tooltip content="Run only the selected text" shortcut={`${modKey}+Shift+Enter`}>
          <button
            onClick={onExecuteSelection}
            disabled={isExecuting}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm",
              "bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)]",
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              "transition-colors duration-150",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <PlaySquare className="w-4 h-4" />
            <span className="hidden sm:inline">Selection</span>
            <kbd className="text-[var(--text-muted)] text-xs ml-1 hidden lg:inline">{modKey}+⇧+↵</kbd>
          </button>
        </Tooltip>

        <div className="w-px h-6 bg-[var(--border-color)] mx-1" />

        <Tooltip content="Format and beautify SQL" shortcut={`${modKey}+Shift+F`}>
          <button
            onClick={onFormat}
            disabled={isExecuting}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm",
              "bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)]",
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              "transition-colors duration-150",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Format</span>
            <kbd className="text-[var(--text-muted)] text-xs ml-1 hidden lg:inline">{modKey}+⇧+F</kbd>
          </button>
        </Tooltip>
      </div>

      {/* Right side - Save and panels */}
      <div className="flex items-center gap-2">
        <Tooltip content="Save query for later" shortcut={`${modKey}+S`}>
          <button
            onClick={onSave}
            disabled={isExecuting}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm",
              "bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)]",
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              "transition-colors duration-150",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">Save</span>
            <kbd className="text-[var(--text-muted)] text-xs ml-1 hidden lg:inline">{modKey}+S</kbd>
          </button>
        </Tooltip>

        <div className="w-px h-6 bg-[var(--border-color)] mx-1" />

        <Tooltip content="View saved queries">
          <button
            onClick={onToggleSavedQueries}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm",
              "transition-colors duration-150",
              showSavedQueries
                ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                : "bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            <FolderOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Saved</span>
          </button>
        </Tooltip>

        <Tooltip content="View query history">
          <button
            onClick={onToggleHistory}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm",
              "transition-colors duration-150",
              showHistory
                ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                : "bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">History</span>
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
