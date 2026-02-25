# Auto-Detect Local PostgreSQL Databases — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Scan Local Databases" button to the HomePage that discovers running local PostgreSQL instances, lists their databases, and lets the user import them as Tusker projects with one click.

**Architecture:** A new Rust `discovery` module scans for Unix socket files and probes TCP ports to find local PostgreSQL servers. It attempts passwordless connections (trust/peer auth) and reports which databases require a password. The frontend shows results in a modal where users select databases to import.

**Tech Stack:** Rust (sqlx, tokio), React, TypeScript, Zustand, Tailwind CSS, Tauri IPC

---

### Task 1: Create the Rust Discovery Module — Data Structures

**Files:**
- Create: `src-tauri/src/db/discovery.rs`
- Modify: `src-tauri/src/db/mod.rs`

**Step 1: Create `discovery.rs` with data structures**

```rust
// src-tauri/src/db/discovery.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AuthStatus {
    Trust,
    PasswordRequired,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredServer {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_status: AuthStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredDatabase {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub database_name: String,
    pub auth_status: AuthStatus,
    pub already_imported: bool,
}
```

**Step 2: Register the module in `mod.rs`**

Add to `src-tauri/src/db/mod.rs`:

```rust
pub mod discovery;

pub use discovery::{AuthStatus, DiscoveredDatabase, DiscoveredServer};
```

Add these lines after the existing `pub mod export;` line and in the re-exports section.

**Step 3: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles with no errors (warnings about unused are fine).

**Step 4: Commit**

```bash
git add src-tauri/src/db/discovery.rs src-tauri/src/db/mod.rs
git commit -m "feat: add discovery module data structures for local PG detection"
```

---

### Task 2: Implement Socket Scanning

**Files:**
- Modify: `src-tauri/src/db/discovery.rs`

**Step 1: Add socket scanning function**

Add to `discovery.rs`:

```rust
use std::fs;
use std::collections::HashSet;

/// Scan well-known directories for PostgreSQL Unix socket files.
/// Socket files are named `.s.PGSQL.<port>`.
/// Returns a set of discovered ports.
fn scan_socket_dirs() -> HashSet<u16> {
    let socket_dirs = ["/tmp", "/var/run/postgresql"];
    let mut ports = HashSet::new();

    for dir in &socket_dirs {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if let Some(port_str) = name.strip_prefix(".s.PGSQL.") {
                    if let Ok(port) = port_str.parse::<u16>() {
                        ports.insert(port);
                    }
                }
            }
        }
    }

    ports
}
```

**Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles (warning about unused `scan_socket_dirs` is fine).

**Step 3: Commit**

```bash
git add src-tauri/src/db/discovery.rs
git commit -m "feat: add Unix socket scanning for local PG discovery"
```

---

### Task 3: Implement TCP Port Probing

**Files:**
- Modify: `src-tauri/src/db/discovery.rs`

**Step 1: Add TCP probing function**

Add to `discovery.rs`:

```rust
use tokio::net::TcpStream;
use std::time::Duration;

/// Probe localhost on common PostgreSQL ports (5432-5439).
/// Returns ports that accept TCP connections but weren't found via sockets.
async fn probe_tcp_ports(known_ports: &HashSet<u16>) -> HashSet<u16> {
    let mut extra_ports = HashSet::new();

    for port in 5432..=5439 {
        if known_ports.contains(&port) {
            continue;
        }
        let addr = format!("127.0.0.1:{}", port);
        if let Ok(Ok(_)) = tokio::time::timeout(
            Duration::from_secs(1),
            TcpStream::connect(&addr),
        ).await {
            extra_ports.insert(port);
        }
    }

    extra_ports
}
```

**Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles.

**Step 3: Commit**

```bash
git add src-tauri/src/db/discovery.rs
git commit -m "feat: add TCP port probing for local PG discovery"
```

---

### Task 4: Implement Auth Detection & Database Enumeration

**Files:**
- Modify: `src-tauri/src/db/discovery.rs`

**Step 1: Add auth detection and database listing**

Add to `discovery.rs`:

```rust
use sqlx::postgres::PgPoolOptions;
use sqlx::Row;
use log;

/// Try connecting to a PostgreSQL instance without a password.
/// Returns the auth status and, if successful, the list of non-template database names.
async fn probe_server(host: &str, port: u16, username: &str) -> (AuthStatus, Vec<String>) {
    // Try connecting without a password via TCP
    let conn_str = format!(
        "postgres://{}@{}:{}/postgres?sslmode=disable",
        urlencoding::encode(username),
        host,
        port,
    );

    match PgPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(Duration::from_secs(3))
        .connect(&conn_str)
        .await
    {
        Ok(pool) => {
            // Trust auth worked — enumerate databases
            let databases = list_databases(&pool).await;
            pool.close().await;
            (AuthStatus::Trust, databases)
        }
        Err(sqlx::Error::Database(db_err)) => {
            let code = db_err.code().unwrap_or_default();
            if code == "28P01" || code == "28000" {
                // Auth failure — password is required
                // We can't list databases without connecting, so return empty
                (AuthStatus::PasswordRequired, vec![])
            } else {
                log::warn!("Unexpected DB error on port {}: {}", port, db_err);
                // Treat other DB errors as unreachable for now
                (AuthStatus::PasswordRequired, vec![])
            }
        }
        Err(e) => {
            log::debug!("Could not connect to port {}: {}", port, e);
            // Connection refused / timeout — skip this port entirely
            // Return a sentinel that the caller will filter out
            (AuthStatus::PasswordRequired, vec!["__unreachable__".to_string()])
        }
    }
}

async fn list_databases(pool: &sqlx::PgPool) -> Vec<String> {
    match sqlx::query("SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname")
        .fetch_all(pool)
        .await
    {
        Ok(rows) => rows.iter().map(|r| r.get::<String, _>("datname")).collect(),
        Err(e) => {
            log::warn!("Failed to list databases: {}", e);
            vec!["postgres".to_string()]
        }
    }
}
```

**Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles.

**Step 3: Commit**

```bash
git add src-tauri/src/db/discovery.rs
git commit -m "feat: add auth detection and database enumeration for discovery"
```

---

### Task 5: Implement the Main Discovery Function

**Files:**
- Modify: `src-tauri/src/db/discovery.rs`

**Step 1: Add the main `discover_local_databases` function**

Add to `discovery.rs`:

```rust
/// Main discovery entry point.
/// Scans for local PostgreSQL instances via Unix sockets and TCP probing,
/// then enumerates databases on each discovered server.
///
/// `existing_connections` is a list of (host, port, database) tuples that
/// should be marked as already imported.
pub async fn discover_local_databases(
    existing_connections: Vec<(String, u16, String)>,
) -> Vec<DiscoveredDatabase> {
    let username = std::env::var("USER")
        .or_else(|_| std::env::var("USERNAME"))
        .unwrap_or_else(|_| "postgres".to_string());

    // Phase 1: Socket scan
    let socket_ports = scan_socket_dirs();
    log::info!("Socket scan found ports: {:?}", socket_ports);

    // Phase 2: TCP fallback
    let tcp_ports = probe_tcp_ports(&socket_ports).await;
    log::info!("TCP probe found additional ports: {:?}", tcp_ports);

    let all_ports: HashSet<u16> = socket_ports.union(&tcp_ports).cloned().collect();

    if all_ports.is_empty() {
        return vec![];
    }

    let mut results = Vec::new();

    // Phase 3 & 4: Probe each server and enumerate databases
    for port in &all_ports {
        let (auth_status, databases) = probe_server("localhost", *port, &username).await;

        // Skip unreachable servers
        if databases.len() == 1 && databases[0] == "__unreachable__" {
            continue;
        }

        if auth_status == AuthStatus::PasswordRequired && databases.is_empty() {
            // Password required but we couldn't list databases.
            // Add a placeholder entry for the server so user can still enter password.
            let already = existing_connections.iter().any(|(h, p, d)| {
                h == "localhost" && *p == *port && d == "postgres"
            });
            results.push(DiscoveredDatabase {
                host: "localhost".to_string(),
                port: *port,
                username: username.clone(),
                database_name: "postgres".to_string(),
                auth_status: AuthStatus::PasswordRequired,
                already_imported: already,
            });
            continue;
        }

        for db_name in &databases {
            let already = existing_connections.iter().any(|(h, p, d)| {
                h == "localhost" && *p == *port && d == db_name
            });

            results.push(DiscoveredDatabase {
                host: "localhost".to_string(),
                port: *port,
                username: username.clone(),
                database_name: db_name.clone(),
                auth_status: auth_status.clone(),
                already_imported: already,
            });
        }
    }

    // Sort by port then database name for stable UI order
    results.sort_by(|a, b| a.port.cmp(&b.port).then(a.database_name.cmp(&b.database_name)));

    results
}

/// Returns the current OS username.
pub fn get_current_username() -> String {
    std::env::var("USER")
        .or_else(|_| std::env::var("USERNAME"))
        .unwrap_or_else(|_| "postgres".to_string())
}
```

**Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles with no errors.

**Step 3: Commit**

```bash
git add src-tauri/src/db/discovery.rs
git commit -m "feat: implement main discover_local_databases function"
```

---

### Task 6: Add Tauri Commands for Discovery

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/db/mod.rs` (if not already done)

**Step 1: Add import for discovery types in `commands.rs`**

In `src-tauri/src/commands.rs`, add `DiscoveredDatabase` to the import from `crate::db`:

```rust
use crate::db::{
    BulkInsertRequest, ColumnInfo, Commit, CommitDetail, CommitStore, ConnectionConfig,
    ConnectionInfo, ConnectionManager, ConstraintInfo, CredentialStorage, DataOperations,
    DeleteRequest, DiscoveredDatabase, FilterCondition, IndexInfo, InsertRequest,
    MigrationOperations, MigrationRequest, MigrationResult, PaginatedResult, QueryResult,
    SaveCommitChange, SaveCommitRequest, SchemaInfo, SchemaIntrospector, SchemaWithTables,
    SslMode, TableInfo, UpdateRequest,
};
```

**Step 2: Add the Tauri commands**

Add to `src-tauri/src/commands.rs` after the Export/Import section:

```rust
// ============================================================================
// Discovery Commands
// ============================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct ExistingConnection {
    pub host: String,
    pub port: u16,
    pub database: String,
}

#[tauri::command]
pub async fn discover_local_databases(
    existing: Vec<ExistingConnection>,
) -> Result<Vec<DiscoveredDatabase>> {
    let existing_tuples: Vec<(String, u16, String)> = existing
        .into_iter()
        .map(|e| (e.host, e.port, e.database))
        .collect();

    Ok(crate::db::discovery::discover_local_databases(existing_tuples).await)
}

#[tauri::command]
pub fn get_current_username() -> String {
    crate::db::discovery::get_current_username()
}
```

**Step 3: Register commands in `lib.rs`**

In `src-tauri/src/lib.rs`, add to the `invoke_handler` list after `commands::import_connections`:

```rust
            // Discovery commands
            commands::discover_local_databases,
            commands::get_current_username,
```

**Step 4: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles with no errors.

**Step 5: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs src-tauri/src/db/mod.rs
git commit -m "feat: add Tauri commands for local database discovery"
```

---

### Task 7: Add Discovery Modal State to UI Store

**Files:**
- Modify: `src/stores/uiStore.ts`

**Step 1: Add `discoveryModalOpen` to the UIState interface**

Add after the `importModalOpen: boolean;` line in the interface:

```typescript
  // Discovery modal
  discoveryModalOpen: boolean;
```

**Step 2: Add actions to the interface**

Add after `closeImportModal: () => void;`:

```typescript
  openDiscoveryModal: () => void;
  closeDiscoveryModal: () => void;
```

**Step 3: Add initial state**

Add after `importModalOpen: false,`:

```typescript
  discoveryModalOpen: false,
```

**Step 4: Add action implementations**

Add after `closeImportModal: () => set({ importModalOpen: false }),`:

```typescript
  openDiscoveryModal: () => set({ discoveryModalOpen: true }),
  closeDiscoveryModal: () => set({ discoveryModalOpen: false }),
```

**Step 5: Commit**

```bash
git add src/stores/uiStore.ts
git commit -m "feat: add discovery modal state to UI store"
```

---

### Task 8: Create the DiscoveryModal Component

**Files:**
- Create: `src/components/modals/DiscoveryModal.tsx`

**Step 1: Create the full modal component**

```tsx
// src/components/modals/DiscoveryModal.tsx
import { useState, useEffect, useCallback } from "react";
import { Loader2, Search, Check, Lock, Database, Eye, EyeOff } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Modal } from "../ui/Modal";
import { useUIStore } from "../../stores/uiStore";
import { useProjectStore } from "../../stores/projectStore";
import { cn, PROJECT_COLORS } from "../../lib/utils";
import type { ProjectColor } from "../../types";

interface DiscoveredDatabase {
  host: string;
  port: number;
  username: string;
  database_name: string;
  auth_status: "trust" | "password_required";
  already_imported: boolean;
}

interface ExistingConnection {
  host: string;
  port: number;
  database: string;
}

const COLOR_CYCLE: ProjectColor[] = ["blue", "green", "yellow", "orange", "red", "purple"];

export function DiscoveryModal() {
  const { discoveryModalOpen, closeDiscoveryModal, showToast } = useUIStore();
  const { projects, addProject } = useProjectStore();

  const [phase, setPhase] = useState<"scanning" | "results" | "importing">("scanning");
  const [databases, setDatabases] = useState<DiscoveredDatabase[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const runScan = useCallback(async () => {
    setPhase("scanning");
    setError(null);
    setDatabases([]);
    setSelected(new Set());
    setPasswords({});
    setShowPasswords({});
    setPasswordErrors({});

    try {
      const existing: ExistingConnection[] = projects.map((p) => ({
        host: p.connection.host,
        port: p.connection.port,
        database: p.connection.database,
      }));

      const results = await invoke<DiscoveredDatabase[]>("discover_local_databases", {
        existing,
      });

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
      setError(typeof err === "string" ? err : "Failed to scan for local databases.");
      setPhase("results");
    }
  }, [projects]);

  useEffect(() => {
    if (discoveryModalOpen) {
      runScan();
    }
  }, [discoveryModalOpen, runScan]);

  const dbKey = (db: DiscoveredDatabase) => `${db.host}:${db.port}/${db.database_name}`;
  const serverKey = (db: DiscoveredDatabase) => `${db.host}:${db.port}`;

  const toggleSelect = (db: DiscoveredDatabase) => {
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

  const selectableCount = databases.filter((d) => !d.already_imported).length;
  const allSelected = selectableCount > 0 && selected.size === selectableCount;

  const toggleAll = () => {
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

  // Group by server for display
  const servers = databases.reduce<Record<string, DiscoveredDatabase[]>>((acc, db) => {
    const sk = serverKey(db);
    if (!acc[sk]) acc[sk] = [];
    acc[sk].push(db);
    return acc;
  }, {});

  // Which servers need passwords (have selected password-required databases)
  const serversNeedingPassword = new Set<string>();
  for (const db of databases) {
    if (selected.has(dbKey(db)) && db.auth_status === "password_required") {
      serversNeedingPassword.add(serverKey(db));
    }
  }

  const canImport = selected.size > 0 && Array.from(serversNeedingPassword).every(
    (sk) => passwords[sk] && passwords[sk].length > 0
  );

  const handleImport = async () => {
    setPhase("importing");
    setPasswordErrors({});

    // For password-required servers, verify password first
    for (const sk of serversNeedingPassword) {
      const [host, portStr] = sk.split(":");
      const port = parseInt(portStr, 10);
      const password = passwords[sk];
      const db = databases.find(
        (d) => d.host === host && d.port === port
      );
      if (!db) continue;

      try {
        await invoke("test_connection", {
          request: {
            host,
            port,
            database: db.database_name,
            username: db.username,
            password,
            ssl_mode: null,
          },
        });
      } catch {
        setPasswordErrors((prev) => ({
          ...prev,
          [sk]: "Authentication failed. Check your password.",
        }));
        setPhase("results");
        return;
      }
    }

    // Create projects for all selected databases
    const existingNames = new Set(projects.map((p) => p.name));
    let count = 0;

    for (const db of databases) {
      if (!selected.has(dbKey(db))) continue;

      let name = db.database_name;
      if (existingNames.has(name)) {
        let suffix = 1;
        while (existingNames.has(`${db.database_name} (${suffix})`)) {
          suffix++;
        }
        name = `${db.database_name} (${suffix})`;
      }
      existingNames.add(name);

      const color = COLOR_CYCLE[count % COLOR_CYCLE.length];
      const projectId = crypto.randomUUID();

      // Save password to keychain if needed
      const sk = serverKey(db);
      if (db.auth_status === "password_required" && passwords[sk]) {
        try {
          await invoke("save_password", {
            projectId,
            password: passwords[sk],
          });
        } catch (err) {
          console.error("Failed to save password:", err);
        }
      }

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

      count++;
    }

    closeDiscoveryModal();
    showToast(`Imported ${count} database${count === 1 ? "" : "s"}`);
  };

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
          <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
            <Search className="w-6 h-6 text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            Auto-Detect Databases
          </h3>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            {phase === "scanning"
              ? "Scanning for local PostgreSQL databases..."
              : phase === "importing"
                ? "Importing selected databases..."
                : databases.length > 0
                  ? "Select the databases you want to add to Tusker."
                  : "No local PostgreSQL databases were found."}
          </p>
        </div>

        {/* Scanning spinner */}
        {phase === "scanning" && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Results */}
        {phase !== "scanning" && databases.length > 0 && (
          <>
            {/* Select all toggle */}
            {selectableCount > 1 && (
              <button
                onClick={toggleAll}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                {allSelected ? "Deselect All" : "Select All"}
              </button>
            )}

            {/* Database list grouped by server */}
            <div className="max-h-64 overflow-y-auto space-y-3">
              {Object.entries(servers).map(([sk, dbs]) => (
                <div key={sk}>
                  {/* Server header */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      {sk}
                    </span>
                    {dbs[0].auth_status === "trust" ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 font-medium">
                        No password
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-medium flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" />
                        Password required
                      </span>
                    )}
                  </div>

                  {/* Databases */}
                  <div className="space-y-1">
                    {dbs.map((db) => {
                      const key = dbKey(db);
                      const isSelected = selected.has(key);
                      return (
                        <button
                          key={key}
                          onClick={() => toggleSelect(db)}
                          disabled={db.already_imported || phase === "importing"}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors",
                            db.already_imported
                              ? "opacity-40 cursor-not-allowed"
                              : isSelected
                                ? "bg-[var(--accent)]/10 border border-[var(--accent)]/30"
                                : "bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-[var(--text-muted)]/30"
                          )}
                        >
                          {/* Checkbox */}
                          <div
                            className={cn(
                              "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                              db.already_imported
                                ? "border-[var(--border-color)] bg-[var(--bg-tertiary)]"
                                : isSelected
                                  ? "border-[var(--accent)] bg-[var(--accent)]"
                                  : "border-[var(--border-color)]"
                            )}
                          >
                            {(isSelected || db.already_imported) && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </div>

                          <Database className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />

                          <span className="flex-1 truncate text-[var(--text-primary)]">
                            {db.database_name}
                          </span>

                          {db.already_imported && (
                            <span className="text-[10px] text-[var(--text-muted)] shrink-0">
                              Already added
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Password input for this server */}
                  {serversNeedingPassword.has(sk) && (
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                        Password for {sk}
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords[sk] ? "text" : "password"}
                          value={passwords[sk] || ""}
                          onChange={(e) =>
                            setPasswords((prev) => ({ ...prev, [sk]: e.target.value }))
                          }
                          placeholder="Enter database password"
                          className={cn(
                            "w-full h-8 px-3 pr-9 rounded-lg text-sm",
                            "bg-[var(--bg-primary)] border",
                            passwordErrors[sk]
                              ? "border-red-500/50"
                              : "border-[var(--border-color)]",
                            "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
                            "focus:outline-none focus:border-[var(--accent)]",
                            "transition-colors"
                          )}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowPasswords((prev) => ({ ...prev, [sk]: !prev[sk] }))
                          }
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                        >
                          {showPasswords[sk] ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      {passwordErrors[sk] && (
                        <p className="text-xs text-red-400 mt-1">{passwordErrors[sk]}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Empty state */}
        {phase === "results" && databases.length === 0 && !error && (
          <div className="text-center py-6">
            <Database className="w-10 h-10 text-[var(--text-muted)]/30 mx-auto mb-3" />
            <p className="text-sm text-[var(--text-muted)]">
              Make sure PostgreSQL is running on this machine.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={closeDiscoveryModal}
            disabled={phase === "importing"}
            className={cn(
              "flex-1 h-9 px-4 rounded-lg text-sm font-medium",
              "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
              "hover:bg-[var(--border-color)] hover:text-[var(--text-primary)]",
              "transition-colors disabled:opacity-50"
            )}
          >
            Cancel
          </button>
          {databases.length > 0 && (
            <button
              onClick={handleImport}
              disabled={phase === "importing" || !canImport}
              className={cn(
                "flex-1 h-9 px-4 rounded-lg text-sm font-medium",
                "flex items-center justify-center gap-2",
                "bg-blue-600 text-white hover:bg-blue-700",
                "transition-all duration-150 disabled:opacity-50"
              )}
            >
              {phase === "importing" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importing...
                </>
              ) : (
                `Import${selected.size > 0 ? ` (${selected.size})` : ""}`
              )}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/modals/DiscoveryModal.tsx
git commit -m "feat: create DiscoveryModal component for auto-detect"
```

---

### Task 9: Wire Up the DiscoveryModal

**Files:**
- Modify: `src/components/modals/index.ts`
- Modify: `src/App.tsx`

**Step 1: Export from modals index**

Add to `src/components/modals/index.ts`:

```typescript
export { DiscoveryModal } from "./DiscoveryModal";
```

**Step 2: Add to App.tsx**

In `src/App.tsx`, add `DiscoveryModal` to the import:

```typescript
import { ProjectModal, DeleteTableModal, TruncateTableModal, ExportTableModal, HelpModal, SchemaInfoModal, DeleteProjectModal, DropSchemaModal, ExportConnectionsModal, ImportConnectionsModal, DiscoveryModal } from "./components/modals";
```

Add `<DiscoveryModal />` after `<ImportConnectionsModal />`:

```tsx
      <ImportConnectionsModal />
      <DiscoveryModal />
```

**Step 3: Commit**

```bash
git add src/components/modals/index.ts src/App.tsx
git commit -m "feat: wire up DiscoveryModal in App component"
```

---

### Task 10: Add Auto-Detect Button to HomePage

**Files:**
- Modify: `src/components/layout/HomePage.tsx`

**Step 1: Add the import for Radar icon and the openDiscoveryModal action**

Add `Radar` to the lucide-react import (or use `Search` if `Radar` isn't available). Update the `useUIStore` destructuring.

In `HomePage()` function, update:

```typescript
const openDiscoveryModal = useUIStore((s) => s.openDiscoveryModal);
```

**Step 2: Add the Auto-Detect button**

In the `<div className="flex items-center gap-2">` section (line ~250), add before the Import button:

```tsx
              <button
                onClick={openDiscoveryModal}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
                  "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                  "hover:bg-[var(--bg-tertiary)]",
                  "transition-colors"
                )}
              >
                <Search className="w-3.5 h-3.5" />
                Auto-Detect
              </button>
```

Note: `Search` is already imported in this file. No new import needed.

**Step 3: Commit**

```bash
git add src/components/layout/HomePage.tsx
git commit -m "feat: add Auto-Detect button to HomePage"
```

---

### Task 11: Handle Trust Auth in Connection Flow

**Files:**
- Modify: `src-tauri/src/db/connection.rs`
- Modify: `src/hooks/useDatabase.ts`

**Step 1: Add passwordless connection string method to `ConnectionConfig`**

In `src-tauri/src/db/connection.rs`, add a new method to the `impl ConnectionConfig` block:

```rust
    pub fn connection_string_no_password(&self) -> String {
        format!(
            "postgres://{}@{}:{}/{}?sslmode={}",
            urlencoding::encode(&self.username),
            self.host,
            self.port,
            urlencoding::encode(&self.database),
            self.ssl_mode
        )
    }
```

**Step 2: Update `ConnectionManager::connect` to handle empty password**

In `src-tauri/src/db/connection.rs`, update the `connect` method:

```rust
    pub async fn connect(&self, config: ConnectionConfig, password: &str) -> Result<String> {
        let connection_string = if password.is_empty() {
            config.connection_string_no_password()
        } else {
            config.connection_string(password)
        };
        let connection_id = config.id.clone();
```

Similarly update `test_connection`:

```rust
    pub async fn test_connection(config: &ConnectionConfig, password: &str) -> Result<()> {
        let connection_string = if password.is_empty() {
            config.connection_string_no_password()
        } else {
            config.connection_string(password)
        };
```

**Step 3: Update the frontend `useConnect` hook**

In `src/hooks/useDatabase.ts`, find the `useConnect` hook. It should gracefully handle the case where `get_saved_password` fails (no password stored = trust auth). Look at the current implementation and ensure that when `get_saved_password` throws, we pass an empty string instead of failing the whole connection.

Check the existing code — if it already catches errors from `get_saved_password` and falls back to empty string, no change is needed. If not, wrap the `get_saved_password` call in a try-catch that defaults to `""`.

**Step 4: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles.

**Step 5: Commit**

```bash
git add src-tauri/src/db/connection.rs src/hooks/useDatabase.ts
git commit -m "feat: support passwordless connections for trust/peer auth"
```

---

### Task 12: End-to-End Testing

**Files:** None (manual testing)

**Step 1: Build and run the app**

Run: `cd /Users/jad/Documents/Projects/tusker && bun run tauri dev`

**Step 2: Test with local PostgreSQL running**

1. Click "Auto-Detect" on the HomePage
2. Verify the scanning spinner appears
3. Verify databases are listed with correct auth badges
4. Select databases and click "Import"
5. Verify projects appear on the HomePage
6. Click a trust-auth project to verify it connects without asking for a password

**Step 3: Test with no PostgreSQL running**

1. Stop PostgreSQL
2. Click "Auto-Detect"
3. Verify the empty state message appears

**Step 4: Test duplicate detection**

1. Import a database via Auto-Detect
2. Click Auto-Detect again
3. Verify the already-imported database shows "Already added" and is grayed out

**Step 5: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: address issues found during e2e testing"
```
