import { useState, useEffect } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Modal } from "../ui/Modal";
import { useUIStore } from "../../stores/uiStore";
import { useExecuteSQL } from "../../hooks/useDatabase";
import { cn } from "../../lib/utils";

export function DeleteTableModal() {
  const { deleteTableModal, closeDeleteTableModal, tabs, closeTab } = useUIStore();
  const { isOpen, schema, table, rowCount } = deleteTableModal;
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const executeSQL = useExecuteSQL();

  const isConfirmed = confirmText === table;

  useEffect(() => {
    if (!isOpen) {
      setConfirmText("");
      setError(null);
    }
  }, [isOpen]);

  const handleDelete = async () => {
    if (!schema || !table || !isConfirmed) return;

    setError(null);

    try {
      await executeSQL.mutateAsync({
        sql: `DROP TABLE "${schema}"."${table}"`,
      });

      const tableTab = tabs.find(
        (t) => t.type === "table" && t.schema === schema && t.table === table
      );
      if (tableTab) {
        closeTab(tableTab.id);
      }

      closeDeleteTableModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete table");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isConfirmed && !executeSQL.isPending) {
      handleDelete();
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={closeDeleteTableModal}
      showCloseButton={false}
      className="max-w-md"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-6 h-6 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            Delete table?
          </h3>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            This will permanently delete{" "}
            <span className="font-mono text-red-400">{schema}.{table}</span>
            {rowCount !== null && rowCount > 0 && (
              <span> and all {rowCount.toLocaleString()} {rowCount === 1 ? "row" : "rows"}</span>
            )}
            . This cannot be undone.
          </p>
        </div>

        {/* Confirmation input */}
        <div>
          <label className="block text-sm text-[var(--text-secondary)] mb-2">
            To confirm, type <span className="font-mono text-[var(--text-primary)]">{table}</span> below
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className={cn(
              "w-full px-3 py-2.5 rounded-lg text-sm font-mono",
              "bg-[var(--bg-primary)] border",
              "text-[var(--text-primary)]",
              "focus:outline-none focus:ring-2",
              isConfirmed
                ? "border-green-500/50 focus:ring-green-500/20"
                : "border-[var(--border-color)] focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
            )}
          />
        </div>

        {/* Error message */}
        {error && (
          <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={closeDeleteTableModal}
            disabled={executeSQL.isPending}
            className={cn(
              "flex-1 h-9 px-4 rounded-lg text-sm font-medium",
              "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
              "hover:bg-[var(--border-color)] hover:text-[var(--text-primary)]",
              "transition-colors",
              "disabled:opacity-50"
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!isConfirmed || executeSQL.isPending}
            className={cn(
              "flex-1 h-9 px-4 rounded-lg text-sm font-medium",
              "flex items-center justify-center gap-2",
              "transition-all duration-150",
              isConfirmed
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed"
            )}
          >
            {executeSQL.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete table"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
