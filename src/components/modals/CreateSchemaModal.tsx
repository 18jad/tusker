import { useState, useEffect } from "react";
import { Loader2, FolderPlus } from "lucide-react";
import { Modal } from "../ui/Modal";
import { useUIStore } from "../../stores/uiStore";
import { useExecuteSQL } from "../../hooks/useDatabase";
import { cn } from "../../lib/utils";

export function CreateSchemaModal() {
  const { createSchemaModalOpen, closeCreateSchemaModal, showToast } = useUIStore();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const executeSQL = useExecuteSQL();

  const isValid = name.trim().length > 0;

  useEffect(() => {
    if (!createSchemaModalOpen) {
      setName("");
      setError(null);
    }
  }, [createSchemaModalOpen]);

  const handleCreate = async () => {
    if (!isValid) return;

    setError(null);

    try {
      await executeSQL.mutateAsync({
        sql: `CREATE SCHEMA "${name.trim()}"`,
      });

      closeCreateSchemaModal();
      showToast(`Created schema "${name.trim()}"`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create schema");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isValid && !executeSQL.isPending) {
      handleCreate();
    }
  };

  return (
    <Modal
      open={createSchemaModalOpen}
      onClose={closeCreateSchemaModal}
      showCloseButton={false}
      className="max-w-sm"
    >
      <div className="space-y-5">
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-4">
            <FolderPlus className="w-6 h-6 text-[var(--accent)]" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            Create Schema
          </h3>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            Create a new schema in the current database.
          </p>
        </div>

        {/* Name input */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
            Schema Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. analytics"
            className={cn(
              "w-full h-9 px-3 rounded-lg text-sm font-mono",
              "bg-[var(--bg-primary)] border border-[var(--border-color)]",
              "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
              "focus:outline-none focus:border-[var(--accent)]",
              "transition-colors"
            )}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={closeCreateSchemaModal}
            disabled={executeSQL.isPending}
            className={cn(
              "flex-1 h-9 px-4 rounded-lg text-sm font-medium",
              "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
              "hover:bg-[var(--border-color)] hover:text-[var(--text-primary)]",
              "transition-colors disabled:opacity-50"
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!isValid || executeSQL.isPending}
            className={cn(
              "flex-1 h-9 px-4 rounded-lg text-sm font-medium",
              "flex items-center justify-center gap-2",
              "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]",
              "transition-all duration-150 disabled:opacity-50"
            )}
          >
            {executeSQL.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
