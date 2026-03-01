import { useState, useEffect } from "react";
import { Loader2, Download, FileUp, Eye, EyeOff, Lock, LockOpen } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Modal } from "../ui/Modal";
import { useUIStore } from "../../stores/uiStore";
import { useProjectStore } from "../../stores/projectStore";
import { cn } from "../../lib/utils";
import type { ProjectColor } from "../../types";

interface ImportedProject {
  id: string;
  name: string;
  color: string;
  host: string;
  port: number;
  database: string;
  username: string;
  ssl: boolean;
  instant_commit: boolean;
  read_only: boolean;
  last_connected: string | null;
  created_at: string;
}

const VALID_COLORS: ProjectColor[] = ["blue", "green", "yellow", "orange", "red", "purple"];

export function ImportConnectionsModal() {
  const { importModalOpen, closeImportModal, showToast } = useUIStore();
  const { projects, addProject } = useProjectStore();

  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isEncrypted, setIsEncrypted] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!importModalOpen) {
      setFilePath(null);
      setFileName(null);
      setIsEncrypted(null);
      setPassword("");
      setShowPassword(false);
      setError(null);
      setIsChecking(false);
    }
  }, [importModalOpen]);

  const handleChooseFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Tusker Export", extensions: ["tusker"] }],
    });

    if (selected) {
      setFilePath(selected);
      const parts = selected.split(/[/\\]/);
      setFileName(parts[parts.length - 1]);
      setError(null);
      setPassword("");
      setIsEncrypted(null);

      // Check if the file is encrypted
      setIsChecking(true);
      try {
        const encrypted = await invoke<boolean>("check_export_file", {
          filePath: selected,
        });
        setIsEncrypted(encrypted);
      } catch {
        setIsEncrypted(null);
        setError("Could not read file.");
      } finally {
        setIsChecking(false);
      }
    }
  };

  const isValid = filePath && isEncrypted !== null && (isEncrypted ? password.length > 0 : true);

  const handleImport = async () => {
    if (!isValid) return;

    setIsImporting(true);
    setError(null);

    try {
      const imported = await invoke<ImportedProject[]>("import_connections", {
        password: isEncrypted ? password : null,
        filePath,
      });

      // Add each project to the store, handling name conflicts
      const existingNames = new Set(projects.map((p) => p.name));
      let count = 0;

      for (const p of imported) {
        let name = p.name;
        if (existingNames.has(name)) {
          let suffix = 1;
          while (existingNames.has(`${p.name} (imported${suffix > 1 ? ` ${suffix}` : ""})`)) {
            suffix++;
          }
          name = `${p.name} (imported${suffix > 1 ? ` ${suffix}` : ""})`;
        }
        existingNames.add(name);

        const color: ProjectColor = VALID_COLORS.includes(p.color as ProjectColor)
          ? (p.color as ProjectColor)
          : "blue";

        addProject({
          id: p.id,
          name,
          color,
          connection: {
            host: p.host,
            port: p.port,
            database: p.database,
            username: p.username,
            password: "",
            ssl: p.ssl,
          },
          settings: {
            instantCommit: p.instant_commit,
            readOnly: p.read_only,
          },
          lastConnected: p.last_connected ?? undefined,
          createdAt: p.created_at,
        });
        count++;
      }

      closeImportModal();
      showToast(`Imported ${count} connection${count === 1 ? "" : "s"}`);
    } catch (err) {
      console.error("Import error:", err);
      const raw =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : JSON.stringify(err);
      if (raw.includes("Incorrect password") || raw.includes("corrupted")) {
        setError("Incorrect password or corrupted file.");
      } else if (raw.includes("Not a valid Tusker")) {
        setError("This is not a valid Tusker export file.");
      } else {
        setError(raw);
      }
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal
      open={importModalOpen}
      onClose={closeImportModal}
      showCloseButton={false}
      className="max-w-sm"
    >
      <div className="space-y-5">
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <Download className="w-6 h-6 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            Import Connections
          </h3>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            Select a <span className="font-mono text-[var(--accent)]">.tusker</span> file to import connections.
          </p>
        </div>

        {/* File picker */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
            File
          </label>
          <button
            onClick={handleChooseFile}
            className={cn(
              "w-full h-9 px-3 rounded-[4px] text-sm text-left",
              "bg-[var(--bg-primary)] border border-[var(--border-color)]",
              "hover:border-[var(--text-muted)] transition-colors",
              "flex items-center gap-2"
            )}
          >
            <FileUp className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
            <span
              className={cn(
                "truncate flex-1",
                fileName
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-muted)]"
              )}
            >
              {fileName || "Choose .tusker file..."}
            </span>
            {isChecking && (
              <Loader2 className="w-3 h-3 text-[var(--text-muted)] animate-spin shrink-0" />
            )}
          </button>
        </div>

        {/* Encryption status indicator */}
        {filePath && isEncrypted !== null && (
          <div
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-[4px]",
              isEncrypted
                ? "bg-[var(--accent)]/10 border border-[var(--accent)]/20"
                : "bg-[var(--success)]/10 border border-[var(--success)]/20"
            )}
          >
            {isEncrypted ? (
              <Lock className="w-4 h-4 text-[var(--accent)] shrink-0" />
            ) : (
              <LockOpen className="w-4 h-4 text-[var(--success)] shrink-0" />
            )}
            <span className={cn(
              "text-sm",
              isEncrypted ? "text-[var(--accent)]" : "text-[var(--success)]"
            )}>
              {isEncrypted
                ? "This file is encrypted — enter the password below"
                : "This file is not encrypted — ready to import"}
            </span>
          </div>
        )}

        {/* Password field — only for encrypted files */}
        {isEncrypted && (
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Enter export password"
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
            onClick={closeImportModal}
            disabled={isImporting}
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
            onClick={handleImport}
            disabled={isImporting || !isValid}
            className={cn(
              "flex-1 h-9 px-4 rounded-[4px] text-sm font-medium",
              "flex items-center justify-center gap-2",
              "bg-green-600 text-white hover:bg-green-700",
              "transition-all duration-150 disabled:opacity-50"
            )}
          >
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isEncrypted ? "Decrypting..." : "Importing..."}
              </>
            ) : (
              "Import"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
