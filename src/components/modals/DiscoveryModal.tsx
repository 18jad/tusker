import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  Search,
  Database,
  Lock,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Modal } from "../ui/Modal";
import { useUIStore } from "../../stores/uiStore";
import { useProjectStore } from "../../stores/projectStore";
import { cn } from "../../lib/utils";
import type { ProjectColor } from "../../types";

interface DiscoveredDatabase {
  host: string;
  port: number;
  username: string;
  database_name: string;
  auth_status: "trust" | "password_required";
  already_imported: boolean;
}

type ModalPhase = "scanning" | "results" | "importing";

const COLOR_CYCLE: ProjectColor[] = [
  "blue",
  "green",
  "yellow",
  "orange",
  "red",
  "purple",
];

export function DiscoveryModal() {
  const { discoveryModalOpen, closeDiscoveryModal, showToast } = useUIStore();
  const { projects, addProject } = useProjectStore();

  const [phase, setPhase] = useState<ModalPhase>("scanning");
  const [databases, setDatabases] = useState<DiscoveredDatabase[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Password state per server (keyed by "host:port")
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>(
    {}
  );
  const [passwordErrors, setPasswordErrors] = useState<
    Record<string, string>
  >({});
  const [testingPasswords, setTestingPasswords] = useState<Set<string>>(
    new Set()
  );

  const colorIndexRef = useRef(0);

  // Unique key for a database
  const dbKey = useCallback(
    (db: DiscoveredDatabase) =>
      `${db.host}:${db.port}/${db.database_name}/${db.username}`,
    []
  );

  // Server key for password grouping
  const serverKey = useCallback(
    (db: DiscoveredDatabase) => `${db.host}:${db.port}`,
    []
  );

  // Reset state when modal closes
  useEffect(() => {
    if (!discoveryModalOpen) {
      setPhase("scanning");
      setDatabases([]);
      setSelected(new Set());
      setError(null);
      setScanError(null);
      setPasswords({});
      setShowPasswords({});
      setPasswordErrors({});
      setTestingPasswords(new Set());
      colorIndexRef.current = 0;
    }
  }, [discoveryModalOpen]);

  // Auto-scan when modal opens
  useEffect(() => {
    if (!discoveryModalOpen) return;
    runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discoveryModalOpen]);

  const runScan = async () => {
    setPhase("scanning");
    setScanError(null);
    setError(null);

    try {
      const existing = projects.map((p) => ({
        host: p.connection.host,
        port: p.connection.port,
        database: p.connection.database,
      }));

      const results = await invoke<DiscoveredDatabase[]>(
        "discover_local_databases",
        { existing }
      );

      setDatabases(results);

      // Auto-select all non-imported databases
      const autoSelected = new Set<string>();
      for (const db of results) {
        if (!db.already_imported) {
          autoSelected.add(dbKey(db));
        }
      }
      setSelected(autoSelected);
      setPhase("results");
    } catch (err) {
      console.error("Discovery error:", err);
      const raw =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : JSON.stringify(err);
      setScanError(raw);
      setPhase("results");
    }
  };

  // Group databases by server (port)
  const serverGroups = databases.reduce<
    Record<string, DiscoveredDatabase[]>
  >((acc, db) => {
    const key = serverKey(db);
    if (!acc[key]) acc[key] = [];
    acc[key].push(db);
    return acc;
  }, {});

  const toggleSelection = (db: DiscoveredDatabase) => {
    if (db.already_imported) return;
    const key = dbKey(db);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectableCount = databases.filter((db) => !db.already_imported).length;
  const selectedCount = selected.size;
  const allSelected = selectableCount > 0 && selectedCount === selectableCount;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      const all = new Set<string>();
      for (const db of databases) {
        if (!db.already_imported) {
          all.add(dbKey(db));
        }
      }
      setSelected(all);
    }
  };

  // Determine which servers need passwords based on selection
  const serversNeedingPassword = (): Set<string> => {
    const servers = new Set<string>();
    for (const db of databases) {
      if (
        selected.has(dbKey(db)) &&
        db.auth_status === "password_required" &&
        !db.already_imported
      ) {
        servers.add(serverKey(db));
      }
    }
    return servers;
  };

  const handlePasswordChange = (sKey: string, value: string) => {
    setPasswords((prev) => ({ ...prev, [sKey]: value }));
    // Clear error when user types
    setPasswordErrors((prev) => {
      const next = { ...prev };
      delete next[sKey];
      return next;
    });
  };

  const toggleShowPassword = (sKey: string) => {
    setShowPasswords((prev) => ({ ...prev, [sKey]: !prev[sKey] }));
  };

  const getNextColor = (): ProjectColor => {
    const color = COLOR_CYCLE[colorIndexRef.current % COLOR_CYCLE.length];
    colorIndexRef.current++;
    return color;
  };

  const deduplicateName = (baseName: string, existingNames: Set<string>): string => {
    if (!existingNames.has(baseName)) return baseName;
    let suffix = 1;
    while (existingNames.has(`${baseName} (${suffix})`)) {
      suffix++;
    }
    return `${baseName} (${suffix})`;
  };

  const handleImport = async () => {
    setError(null);
    setPasswordErrors({});

    const selectedDbs = databases.filter(
      (db) => selected.has(dbKey(db)) && !db.already_imported
    );

    if (selectedDbs.length === 0) return;

    // First, test all passwords for password-required servers
    const needPassword = serversNeedingPassword();
    const failedServers = new Map<string, string>();

    for (const sKey of needPassword) {
      const pw = passwords[sKey] || "";
      if (!pw) {
        failedServers.set(sKey, "Password is required");
        continue;
      }

      // Find a representative database for this server to test connection
      const testDb = selectedDbs.find(
        (db) =>
          serverKey(db) === sKey && db.auth_status === "password_required"
      );

      if (testDb) {
        setTestingPasswords((prev) => new Set(prev).add(sKey));
        try {
          await invoke("test_connection", {
            request: {
              host: testDb.host,
              port: testDb.port,
              database: testDb.database_name,
              username: testDb.username,
              password: pw,
              ssl_mode: null,
            },
          });
        } catch (err) {
          const raw =
            err instanceof Error
              ? err.message
              : typeof err === "string"
                ? err
                : JSON.stringify(err);
          failedServers.set(sKey, raw);
        } finally {
          setTestingPasswords((prev) => {
            const next = new Set(prev);
            next.delete(sKey);
            return next;
          });
        }
      }
    }

    if (failedServers.size > 0) {
      const errors: Record<string, string> = {};
      for (const [sKey, msg] of failedServers) {
        errors[sKey] = msg;
      }
      setPasswordErrors(errors);
      return;
    }

    // All passwords verified — now import
    setPhase("importing");

    try {
      const existingNames = new Set(projects.map((p) => p.name));
      let count = 0;

      for (const db of selectedDbs) {
        const projectId = crypto.randomUUID();
        const name = deduplicateName(db.database_name, existingNames);
        existingNames.add(name);
        const color = getNextColor();

        const sKey = serverKey(db);
        const pw =
          db.auth_status === "password_required" ? passwords[sKey] || "" : "";

        addProject({
          id: projectId,
          name,
          color,
          connection: {
            host: db.host,
            port: db.port,
            database: db.database_name,
            username: db.username,
            password: "",
            ssl: false,
          },
          settings: {
            instantCommit: true,
            readOnly: false,
          },
          createdAt: new Date().toISOString(),
        });

        // Save password to keychain if one was provided
        if (pw) {
          try {
            await invoke("save_password", { projectId, password: pw });
          } catch (err) {
            console.error("Failed to save password for", db.database_name, err);
          }
        }

        count++;
      }

      closeDiscoveryModal();
      showToast(`Imported ${count} database${count === 1 ? "" : "s"}`);
    } catch (err) {
      console.error("Import error:", err);
      const raw =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : JSON.stringify(err);
      setError(raw);
      setPhase("results");
    }
  };

  const needPasswordServers = serversNeedingPassword();
  const hasSelectedDbs =
    databases.filter((db) => selected.has(dbKey(db)) && !db.already_imported)
      .length > 0;
  const canImport =
    hasSelectedDbs &&
    Array.from(needPasswordServers).every(
      (sk) => passwords[sk] && passwords[sk].length > 0
    );

  return (
    <Modal
      open={discoveryModalOpen}
      onClose={closeDiscoveryModal}
      showCloseButton={false}
      className="max-w-md"
    >
      <div className="space-y-5">
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-4">
            <Search className="w-6 h-6 text-[var(--accent)]" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            Discover Local Databases
          </h3>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            Auto-detect PostgreSQL databases running on your machine.
          </p>
        </div>

        {/* Scanning state */}
        {phase === "scanning" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
            <p className="text-sm text-[var(--text-muted)]">
              Scanning for local PostgreSQL databases...
            </p>
          </div>
        )}

        {/* Importing state */}
        {phase === "importing" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
            <p className="text-sm text-[var(--text-muted)]">Importing...</p>
          </div>
        )}

        {/* Results state */}
        {phase === "results" && (
          <>
            {/* Scan error */}
            {scanError && (
              <div className="px-3 py-2.5 rounded-[4px] bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {scanError}
              </div>
            )}

            {/* No databases found */}
            {!scanError && databases.length === 0 && (
              <div className="text-center py-6">
                <Database className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-3 opacity-50" />
                <p className="text-sm text-[var(--text-muted)]">
                  No PostgreSQL databases found locally.
                </p>
                <button
                  onClick={runScan}
                  className={cn(
                    "mt-3 inline-flex items-center gap-1.5 px-3 h-8 rounded-[4px] text-sm",
                    "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                    "bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)]",
                    "transition-colors"
                  )}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry
                </button>
              </div>
            )}

            {/* Database list */}
            {databases.length > 0 && (
              <>
                {/* Select all toggle */}
                {selectableCount > 0 && (
                  <div className="flex items-center justify-between">
                    <button
                      onClick={toggleSelectAll}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                    >
                      {allSelected ? "Deselect All" : "Select All"}
                    </button>
                    <span className="text-xs text-[var(--text-muted)]">
                      {selectedCount} of {selectableCount} selected
                    </span>
                  </div>
                )}

                {/* Grouped database list */}
                <div className="max-h-64 overflow-y-auto space-y-3 -mx-1 px-1">
                  {Object.entries(serverGroups).map(([sKey, dbs]) => (
                    <div key={sKey}>
                      {/* Server header */}
                      <div className="text-xs font-medium text-[var(--text-muted)] mb-1.5 flex items-center gap-1.5">
                        <Database className="w-3 h-3" />
                        localhost:{dbs[0].port}
                        <span className="text-[var(--text-muted)]/60">
                          ({dbs[0].username})
                        </span>
                      </div>

                      {/* Database items */}
                      <div className="space-y-1">
                        {dbs.map((db) => {
                          const key = dbKey(db);
                          const isSelected = selected.has(key);
                          const isImported = db.already_imported;

                          return (
                            <button
                              key={key}
                              onClick={() => toggleSelection(db)}
                              disabled={isImported}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-2 rounded-[4px] text-left transition-colors",
                                isImported
                                  ? "opacity-50 cursor-not-allowed"
                                  : isSelected
                                    ? "bg-[var(--accent)]/10 border border-[var(--accent)]/20"
                                    : "bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-[var(--text-muted)]"
                              )}
                            >
                              {/* Checkbox */}
                              <div
                                className={cn(
                                  "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                                  isImported
                                    ? "bg-[var(--bg-tertiary)] border-[var(--border-color)]"
                                    : isSelected
                                      ? "bg-[var(--accent)] border-[var(--accent)]"
                                      : "border-[var(--border-color)]"
                                )}
                              >
                                {(isSelected || isImported) && (
                                  <Check className="w-3 h-3 text-white" />
                                )}
                              </div>

                              {/* Database info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={cn(
                                      "text-sm font-medium truncate",
                                      isImported
                                        ? "text-[var(--text-muted)]"
                                        : "text-[var(--text-primary)]"
                                    )}
                                  >
                                    {db.database_name}
                                  </span>
                                </div>
                              </div>

                              {/* Status badge */}
                              <div className="shrink-0">
                                {isImported ? (
                                  <span className="text-xs text-[var(--text-muted)]">
                                    Already added
                                  </span>
                                ) : db.auth_status === "trust" ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                                    No password
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                                    <Lock className="w-3 h-3" />
                                    Password required
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Password input for this server (if any selected db requires it) */}
                      {needPasswordServers.has(sKey) && (
                        <div className="mt-2 ml-7">
                          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                            Password for localhost:{dbs[0].port}
                          </label>
                          <div className="relative">
                            <input
                              type={showPasswords[sKey] ? "text" : "password"}
                              value={passwords[sKey] || ""}
                              onChange={(e) =>
                                handlePasswordChange(sKey, e.target.value)
                              }
                              placeholder="Enter password"
                              className={cn(
                                "w-full h-8 px-3 pr-9 rounded-[4px] text-sm",
                                "bg-[var(--bg-primary)] border",
                                passwordErrors[sKey]
                                  ? "border-red-500/50"
                                  : "border-[var(--border-color)]",
                                "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
                                "focus:outline-none focus:border-[var(--accent)]",
                                "transition-colors"
                              )}
                            />
                            <button
                              type="button"
                              onClick={() => toggleShowPassword(sKey)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                            >
                              {showPasswords[sKey] ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          {passwordErrors[sKey] && (
                            <p className="mt-1 text-xs text-red-400">
                              {passwordErrors[sKey]}
                            </p>
                          )}
                          {testingPasswords.has(sKey) && (
                            <p className="mt-1 text-xs text-[var(--text-muted)] flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Verifying password...
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* General error */}
            {error && (
              <div className="px-3 py-2.5 rounded-[4px] bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={closeDiscoveryModal}
                className={cn(
                  "flex-1 h-9 px-4 rounded-[4px] text-sm font-medium",
                  "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
                  "hover:bg-[var(--border-color)] hover:text-[var(--text-primary)]",
                  "transition-colors"
                )}
              >
                Cancel
              </button>
              {databases.length > 0 && (
                <button
                  onClick={handleImport}
                  disabled={!canImport}
                  className={cn(
                    "flex-1 h-9 px-4 rounded-[4px] text-sm font-medium",
                    "flex items-center justify-center gap-2",
                    "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]",
                    "transition-all duration-150 disabled:opacity-50"
                  )}
                >
                  Import Selected
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
