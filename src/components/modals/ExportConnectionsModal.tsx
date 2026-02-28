import { useState, useEffect } from "react";
import { Loader2, Download, Eye, EyeOff } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { Modal } from "../ui/Modal";
import { useUIStore } from "../../stores/uiStore";
import { useProjectStore } from "../../stores/projectStore";
import { cn } from "../../lib/utils";

export function ExportConnectionsModal() {
  const { exportModalOpen, closeExportModal, showToast } = useUIStore();
  const projects = useProjectStore((s) => s.projects);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!exportModalOpen) {
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setError(null);
    }
  }, [exportModalOpen]);

  const passwordsMatch = password === confirmPassword;
  const isValid = password.length >= 8 && passwordsMatch;

  const handleExport = async () => {
    if (!isValid) return;

    setIsExporting(true);
    setError(null);

    try {
      const filePath = await save({
        defaultPath: "connections.tusker",
        filters: [{ name: "Tusker Export", extensions: ["tusker"] }],
      });

      if (!filePath) {
        setIsExporting(false);
        return;
      }

      const projectsForExport = projects.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        host: p.connection.host,
        port: p.connection.port,
        database: p.connection.database,
        username: p.connection.username,
        ssl: p.connection.ssl,
        instant_commit: p.settings.instantCommit,
        read_only: p.settings.readOnly,
        last_connected: p.lastConnected ?? null,
        created_at: p.createdAt,
      }));

      await invoke("export_connections", {
        projects: projectsForExport,
        password,
        filePath,
      });

      closeExportModal();
      showToast(`Exported ${projects.length} connection${projects.length === 1 ? "" : "s"}`);
    } catch (err) {
      console.error("Export error:", err);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : JSON.stringify(err);
      setError(message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal
      open={exportModalOpen}
      onClose={closeExportModal}
      showCloseButton={false}
      className="max-w-sm"
    >
      <div className="space-y-5">
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-4">
            <Download className="w-6 h-6 text-[var(--accent)]" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            Export Connections
          </h3>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            {projects.length} connection{projects.length === 1 ? "" : "s"} will
            be encrypted and saved to a <span className="font-mono text-[var(--accent)]">.tusker</span> file.
          </p>
        </div>

        {/* Password fields */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Encryption Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className={cn(
                  "w-full h-9 px-3 pr-9 rounded-[4px] text-sm",
                  "bg-[var(--bg-primary)] border border-[var(--border-color)]",
                  "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
                  "focus:outline-none focus:border-[var(--accent)]",
                  "transition-colors"
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Confirm Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className={cn(
                "w-full h-9 px-3 rounded-[4px] text-sm",
                "bg-[var(--bg-primary)] border",
                confirmPassword && !passwordsMatch
                  ? "border-red-500/50"
                  : "border-[var(--border-color)]",
                "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
                "focus:outline-none focus:border-[var(--accent)]",
                "transition-colors"
              )}
            />
            {confirmPassword && !passwordsMatch && (
              <p className="text-xs text-red-400 mt-1">Passwords don't match</p>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-3 py-2.5 rounded-[4px] bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={closeExportModal}
            disabled={isExporting}
            className={cn(
              "flex-1 h-9 px-4 rounded-[4px] text-sm font-medium",
              "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
              "hover:bg-[var(--border-color)] hover:text-[var(--text-primary)]",
              "transition-colors disabled:opacity-50"
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || !isValid}
            className={cn(
              "flex-1 h-9 px-4 rounded-[4px] text-sm font-medium",
              "flex items-center justify-center gap-2",
              "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]",
              "transition-all duration-150 disabled:opacity-50"
            )}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Encrypting...
              </>
            ) : (
              "Export"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
