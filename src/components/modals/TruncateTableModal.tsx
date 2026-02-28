import { useState, useEffect } from "react";
import { Loader2, Eraser } from "lucide-react";
import { Modal } from "../ui/Modal";
import { useUIStore } from "../../stores/uiStore";
import { useProjectStore } from "../../stores/projectStore";
import { useExecuteSQL } from "../../hooks/useDatabase";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "../../lib/utils";

export function TruncateTableModal() {
  const { truncateTableModal, closeTruncateTableModal } = useUIStore();
  const { isOpen, schema, table, rowCount } = truncateTableModal;
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const activeConnectionId = useUIStore((s) => s.getActiveConnectionId());
  const activeProjectId = useUIStore((s) => s.getActiveProjectId());
  const connections = useProjectStore((s) => s.connections);

  const connectionId = activeConnectionId ?? Object.values(connections)[0]?.connectionId;
  const projectId = activeProjectId ?? Object.keys(connections)[0];

  const executeSQL = useExecuteSQL();

  useEffect(() => {
    if (!isOpen) {
      setError(null);
    }
  }, [isOpen]);

  const handleTruncate = async () => {
    if (!schema || !table || !connectionId || !projectId) return;

    setError(null);

    try {
      await executeSQL.mutateAsync({
        connectionId,
        projectId,
        sql: `TRUNCATE TABLE "${schema}"."${table}"`,
      });

      // Refresh the table data
      queryClient.invalidateQueries({
        queryKey: ["tableData", schema, table],
      });

      closeTruncateTableModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to truncate table");
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={closeTruncateTableModal}
      showCloseButton={false}
      className="max-w-md"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <Eraser className="w-6 h-6 text-amber-500" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            Truncate table?
          </h3>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            This will delete all rows from{" "}
            <span className="font-mono text-amber-400">{schema}.{table}</span>
            {rowCount !== null && rowCount > 0 && (
              <span> ({rowCount.toLocaleString()} {rowCount === 1 ? "row" : "rows"})</span>
            )}
            . The table structure will be preserved.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="px-3 py-2.5 rounded-[4px] bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={closeTruncateTableModal}
            disabled={executeSQL.isPending}
            className={cn(
              "flex-1 h-9 px-4 rounded-[4px] text-sm font-medium",
              "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
              "hover:bg-[var(--border-color)] hover:text-[var(--text-primary)]",
              "transition-colors",
              "disabled:opacity-50"
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleTruncate}
            disabled={executeSQL.isPending}
            className={cn(
              "flex-1 h-9 px-4 rounded-[4px] text-sm font-medium",
              "flex items-center justify-center gap-2",
              "bg-amber-600 text-white hover:bg-amber-700",
              "transition-all duration-150",
              "disabled:opacity-50"
            )}
          >
            {executeSQL.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Truncating...
              </>
            ) : (
              "Truncate"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
