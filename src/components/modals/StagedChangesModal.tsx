import { useEffect, useRef, useCallback, useState } from "react";
import { X, Trash2, Play, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "../ui/Button";
import { useChangesStore } from "../../stores/changesStore";
import { useUIStore } from "../../stores/uiStore";
import { useCommitChanges } from "../../hooks/useDatabase";
import { cn } from "../../lib/utils";
import type { StagedChange } from "../../types";

const CHANGE_TYPE_STYLES: Record<
  StagedChange["type"],
  { bg: string; border: string; badge: string; label: string }
> = {
  insert: {
    bg: "bg-green-500/5",
    border: "border-green-500/20",
    badge: "bg-green-500/20 text-green-400",
    label: "INSERT",
  },
  update: {
    bg: "bg-amber-500/5",
    border: "border-amber-500/20",
    badge: "bg-amber-500/20 text-amber-400",
    label: "UPDATE",
  },
  delete: {
    bg: "bg-red-500/5",
    border: "border-red-500/20",
    badge: "bg-red-500/20 text-red-400",
    label: "DELETE",
  },
};

export function StagedChangesModal() {
  const { stagedChangesOpen, toggleStagedChanges } = useUIStore();
  const { changes, removeChange, clearChanges } = useChangesStore();
  const drawerRef = useRef<HTMLDivElement>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  const commitChanges = useCommitChanges();

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && stagedChangesOpen) {
        toggleStagedChanges();
      }
    },
    [stagedChangesOpen, toggleStagedChanges]
  );

  useEffect(() => {
    if (stagedChangesOpen) {
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [stagedChangesOpen, handleEscape]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      toggleStagedChanges();
    }
  };

  const handleCommit = async () => {
    setCommitError(null);
    const queries = changes.map((c) => c.sql);

    try {
      await commitChanges.mutateAsync(queries);
      clearChanges();
      toggleStagedChanges();
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : "Failed to commit changes");
    }
  };

  const handleDiscardAll = () => {
    clearChanges();
    setCommitError(null);
  };

  if (!stagedChangesOpen) return null;

  return (
    <div
      onClick={handleOverlayClick}
      className={cn(
        "fixed inset-0 z-50 flex items-end justify-center",
        "bg-black/40 backdrop-blur-sm",
        "animate-in fade-in duration-200"
      )}
    >
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Staged Changes"
        className={cn(
          "w-full max-w-4xl max-h-[70vh]",
          "bg-[var(--bg-secondary)] border-t border-x border-[var(--border-color)]",
          "rounded-t-xl shadow-2xl shadow-black/40",
          "flex flex-col",
          "animate-in slide-in-from-bottom duration-300"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Staged Changes
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
              {changes.length} {changes.length === 1 ? "change" : "changes"}
            </span>
          </div>
          <button
            onClick={toggleStagedChanges}
            className={cn(
              "p-1.5 rounded-lg",
              "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
              "hover:bg-[var(--bg-tertiary)]",
              "transition-colors duration-150"
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {changes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-12 h-12 text-[var(--text-muted)] mb-3" />
              <p className="text-[var(--text-secondary)]">No staged changes</p>
              <p className="text-sm text-[var(--text-muted)]">
                Your changes will appear here before committing
              </p>
            </div>
          ) : (
            changes.map((change) => (
              <ChangeItem
                key={change.id}
                change={change}
                onRemove={() => removeChange(change.id)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        {changes.length > 0 && (
          <div className="px-6 py-4 border-t border-[var(--border-color)]">
            {commitError && (
              <div className="mb-3 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {commitError}
              </div>
            )}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDiscardAll}
                disabled={commitChanges.isPending}
                iconLeft={<Trash2 className="w-4 h-4" />}
              >
                Discard All
              </Button>
              <Button
                variant="primary"
                onClick={handleCommit}
                disabled={commitChanges.isPending}
                iconLeft={commitChanges.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              >
                {commitChanges.isPending ? "Committing..." : "Commit Changes"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ChangeItemProps {
  change: StagedChange;
  onRemove: () => void;
}

function ChangeItem({ change, onRemove }: ChangeItemProps) {
  const styles = CHANGE_TYPE_STYLES[change.type];

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        styles.bg,
        styles.border,
        "transition-colors duration-150"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={cn(
                "px-2 py-0.5 rounded text-xs font-mono font-medium",
                styles.badge
              )}
            >
              {styles.label}
            </span>
            <span className="text-sm text-[var(--text-secondary)]">
              {change.schema}.{change.table}
            </span>
          </div>
          <pre
            className={cn(
              "text-xs font-mono p-3 rounded-md overflow-x-auto",
              "bg-[var(--bg-primary)] text-[var(--text-primary)]",
              "border border-[var(--border-color)]"
            )}
          >
            {change.sql}
          </pre>
        </div>
        <button
          onClick={onRemove}
          className={cn(
            "p-1.5 rounded-lg shrink-0",
            "text-[var(--text-muted)] hover:text-red-400",
            "hover:bg-red-500/10",
            "transition-colors duration-150"
          )}
          title="Remove change"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
