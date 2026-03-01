import { useState, useEffect } from "react";
import { Loader2, Upload, Eye, EyeOff, Lock, LockOpen } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { Modal } from "../ui/Modal";
import { useUIStore } from "../../stores/uiStore";
import { useProjectStore } from "../../stores/projectStore";
import { cn } from "../../lib/utils";

export function ExportConnectionsModal() {
  const { exportModalOpen, closeExportModal, showToast } = useUIStore();
  const projects = useProjectStore((s) => s.projects);

  const [encrypt, setEncrypt] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!exportModalOpen) {
      setEncrypt(false);
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setError(null);
    }
  }, [exportModalOpen]);

  const passwordsMatch = password === confirmPassword;
  const isValid = encrypt ? password.length > 0 && passwordsMatch : true;

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
        password: encrypt ? password : null,
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
            <Upload className="w-6 h-6 text-[var(--accent)]" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            Export Connections
          </h3>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            {projects.length} connection{projects.length === 1 ? "" : "s"} will
            be saved to a <span className="font-mono text-[var(--accent)]">.tusker</span> file.
          </p>
        </div>

        {/* Encrypt toggle */}
        <button
          type="button"
          onClick={() => {
            setEncrypt((v) => !v);
            if (encrypt) {
              setPassword("");
              setConfirmPassword("");
            }
          }}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-[4px] text-left transition-colors",
            encrypt
              ? "bg-[var(--accent)]/10 border border-[var(--accent)]/30"
              : "bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-[var(--text-muted)]/40"
          )}
        >
          {encrypt ? (
            <Lock className="w-4 h-4 text-[var(--accent)] shrink-0" />
          ) : (
            <LockOpen className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <span className={cn(
              "text-sm font-medium",
              encrypt ? "text-[var(--accent)]" : "text-[var(--text-primary)]"
            )}>
              Encrypt with password
            </span>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              {encrypt
                ? "File will be encrypted with AES-256"
                : "File will be exported as plain JSON"}
            </p>
          </div>
          <div
            className={cn(
              "w-8 h-[18px] rounded-full transition-colors relative shrink-0",
              encrypt ? "bg-[var(--accent)]" : "bg-[var(--border-color)]"
            )}
          >
            <div
              className={cn(
                "absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all",
                encrypt ? "left-[14px]" : "left-[2px]"
              )}
            />
          </div>
        </button>

        {/* Password fields — only when encrypting */}
        {encrypt && (
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
                  placeholder="Enter a password"
                  className={cn(
                    "w-full h-9 px-3 pr-9 rounded-[4px] text-sm",
                    "bg-[var(--bg-primary)] border border-[var(--border-color)]",
                    "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
                    "focus:outline-none focus:border-[var(--accent)]",
                    "transition-colors"
                  )}
                  autoFocus
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
        )}

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
                {encrypt ? "Encrypting..." : "Exporting..."}
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
