# Commits & Staged Changes UI Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the staged changes modal from raw SQL display into a human-readable GitHub-like diff view, and add persistent commit history with per-project SQLite storage.

**Architecture:** The Rust backend gets a new `commit_store` module that manages per-project SQLite databases for commit history. The frontend gets a redesigned `StagedChangesModal` with human-readable change cards (field-by-field diff tables for updates, property lists for inserts/deletes), plus a new `CommitHistoryTab` component. The existing `changesStore` is extended to support the commit message flow.

**Tech Stack:** Tauri 2 (Rust), SQLite via rusqlite, React 19, TypeScript, Zustand, TanStack Query, Tailwind CSS, Lucide icons.

---

### Task 1: Add rusqlite dependency to Rust backend

**Files:**
- Modify: `src-tauri/Cargo.toml:24-61`

**Step 1: Add rusqlite to Cargo.toml**

Add this line after the `hex = "0.4"` line (line 58) in `src-tauri/Cargo.toml`:

```toml
# Local SQLite for commit history
rusqlite = { version = "0.31", features = ["bundled"] }

# SHA-256 hashing for commit IDs
sha2 = "0.10"
```

**Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Successful compilation (dependencies download + check pass)

**Step 3: Commit**

```bash
git add src-tauri/Cargo.toml
git commit -m "feat: add rusqlite and sha2 dependencies for commit history"
```

---

### Task 2: Create the Rust commit_store module

**Files:**
- Create: `src-tauri/src/db/commit_store.rs`
- Modify: `src-tauri/src/db/mod.rs`

**Step 1: Create the commit_store module**

Create `src-tauri/src/db/commit_store.rs` with the full SQLite commit storage implementation:

```rust
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Commit {
    pub id: String,
    pub parent_id: Option<String>,
    pub message: String,
    pub summary: String,
    pub created_at: String,
    pub change_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitChange {
    pub id: i64,
    pub commit_id: String,
    #[serde(rename = "type")]
    pub change_type: String,
    pub schema_name: String,
    pub table_name: String,
    pub data: String,
    pub original_data: Option<String>,
    pub sql: String,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitDetail {
    pub commit: Commit,
    pub changes: Vec<CommitChange>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveCommitRequest {
    pub project_id: String,
    pub message: String,
    pub summary: String,
    pub changes: Vec<SaveCommitChange>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveCommitChange {
    #[serde(rename = "type")]
    pub change_type: String,
    pub schema_name: String,
    pub table_name: String,
    pub data: String,
    pub original_data: Option<String>,
    pub sql: String,
}

pub struct CommitStore;

impl CommitStore {
    /// Get the path to the SQLite database for a project
    fn db_path(project_id: &str) -> Result<PathBuf, String> {
        let data_dir = dirs::data_dir()
            .ok_or_else(|| "Could not find app data directory".to_string())?;
        let commits_dir = data_dir.join("com.tusker.app").join("commits");
        std::fs::create_dir_all(&commits_dir)
            .map_err(|e| format!("Failed to create commits directory: {}", e))?;
        Ok(commits_dir.join(format!("{}.db", project_id)))
    }

    /// Open a connection and ensure tables exist
    fn open(project_id: &str) -> Result<Connection, String> {
        let path = Self::db_path(project_id)?;
        let conn = Connection::open(&path)
            .map_err(|e| format!("Failed to open commit database: {}", e))?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS commits (
                id TEXT PRIMARY KEY,
                parent_id TEXT,
                message TEXT NOT NULL,
                summary TEXT NOT NULL,
                created_at TEXT NOT NULL,
                change_count INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS commit_changes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                commit_id TEXT NOT NULL REFERENCES commits(id),
                type TEXT NOT NULL,
                schema_name TEXT NOT NULL,
                table_name TEXT NOT NULL,
                data TEXT NOT NULL,
                original_data TEXT,
                sql TEXT NOT NULL,
                sort_order INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_commit_changes_commit_id ON commit_changes(commit_id);"
        ).map_err(|e| format!("Failed to initialize commit tables: {}", e))?;

        Ok(conn)
    }

    /// Generate a commit hash from parent + timestamp + SQL content
    fn generate_hash(parent_id: &Option<String>, timestamp: &str, sql_statements: &[String]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(parent_id.as_deref().unwrap_or("root"));
        hasher.update(timestamp);
        for sql in sql_statements {
            hasher.update(sql);
        }
        let result = hasher.finalize();
        hex::encode(&result[..])
    }

    /// Get the latest commit ID for this project (to use as parent)
    fn get_latest_commit_id(conn: &Connection) -> Result<Option<String>, String> {
        let mut stmt = conn.prepare(
            "SELECT id FROM commits ORDER BY created_at DESC LIMIT 1"
        ).map_err(|e| format!("Failed to query latest commit: {}", e))?;

        let result = stmt.query_row([], |row| row.get::<_, String>(0)).ok();
        Ok(result)
    }

    /// Save a new commit with its changes
    pub fn save_commit(request: SaveCommitRequest) -> Result<Commit, String> {
        let conn = Self::open(&request.project_id)?;
        let parent_id = Self::get_latest_commit_id(&conn)?;

        let now = chrono::Utc::now().to_rfc3339();
        let sql_statements: Vec<String> = request.changes.iter().map(|c| c.sql.clone()).collect();
        let hash = Self::generate_hash(&parent_id, &now, &sql_statements);

        let commit = Commit {
            id: hash.clone(),
            parent_id: parent_id.clone(),
            message: request.message.clone(),
            summary: request.summary.clone(),
            created_at: now.clone(),
            change_count: request.changes.len() as i64,
        };

        conn.execute(
            "INSERT INTO commits (id, parent_id, message, summary, created_at, change_count)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![commit.id, commit.parent_id, commit.message, commit.summary, commit.created_at, commit.change_count],
        ).map_err(|e| format!("Failed to insert commit: {}", e))?;

        for (i, change) in request.changes.iter().enumerate() {
            conn.execute(
                "INSERT INTO commit_changes (commit_id, type, schema_name, table_name, data, original_data, sql, sort_order)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    hash,
                    change.change_type,
                    change.schema_name,
                    change.table_name,
                    change.data,
                    change.original_data,
                    change.sql,
                    i as i64
                ],
            ).map_err(|e| format!("Failed to insert commit change: {}", e))?;
        }

        Ok(commit)
    }

    /// Get all commits for a project, newest first
    pub fn get_commits(project_id: &str) -> Result<Vec<Commit>, String> {
        let conn = Self::open(project_id)?;

        let mut stmt = conn.prepare(
            "SELECT id, parent_id, message, summary, created_at, change_count
             FROM commits ORDER BY created_at DESC"
        ).map_err(|e| format!("Failed to query commits: {}", e))?;

        let commits = stmt.query_map([], |row| {
            Ok(Commit {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                message: row.get(2)?,
                summary: row.get(3)?,
                created_at: row.get(4)?,
                change_count: row.get(5)?,
            })
        }).map_err(|e| format!("Failed to read commits: {}", e))?
          .collect::<Result<Vec<_>, _>>()
          .map_err(|e| format!("Failed to collect commits: {}", e))?;

        Ok(commits)
    }

    /// Get a single commit with all its changes
    pub fn get_commit_detail(project_id: &str, commit_id: &str) -> Result<CommitDetail, String> {
        let conn = Self::open(project_id)?;

        let commit = conn.query_row(
            "SELECT id, parent_id, message, summary, created_at, change_count
             FROM commits WHERE id = ?1",
            params![commit_id],
            |row| {
                Ok(Commit {
                    id: row.get(0)?,
                    parent_id: row.get(1)?,
                    message: row.get(2)?,
                    summary: row.get(3)?,
                    created_at: row.get(4)?,
                    change_count: row.get(5)?,
                })
            },
        ).map_err(|e| format!("Commit not found: {}", e))?;

        let mut stmt = conn.prepare(
            "SELECT id, commit_id, type, schema_name, table_name, data, original_data, sql, sort_order
             FROM commit_changes WHERE commit_id = ?1 ORDER BY sort_order"
        ).map_err(|e| format!("Failed to query commit changes: {}", e))?;

        let changes = stmt.query_map(params![commit_id], |row| {
            Ok(CommitChange {
                id: row.get(0)?,
                commit_id: row.get(1)?,
                change_type: row.get(2)?,
                schema_name: row.get(3)?,
                table_name: row.get(4)?,
                data: row.get(5)?,
                original_data: row.get(6)?,
                sql: row.get(7)?,
                sort_order: row.get(8)?,
            })
        }).map_err(|e| format!("Failed to read commit changes: {}", e))?
          .collect::<Result<Vec<_>, _>>()
          .map_err(|e| format!("Failed to collect commit changes: {}", e))?;

        Ok(CommitDetail { commit, changes })
    }
}
```

**Step 2: Add the `dirs` crate to Cargo.toml**

Add after the `sha2` line in `src-tauri/Cargo.toml`:

```toml
# Platform-specific directories
dirs = "5"
```

**Step 3: Register the module in mod.rs**

In `src-tauri/src/db/mod.rs`, add after line 3 (`pub mod schema;`):

```rust
pub mod commit_store;
```

And add to the exports at the bottom:

```rust
pub use commit_store::{
    Commit, CommitChange, CommitDetail, CommitStore, SaveCommitChange, SaveCommitRequest,
};
```

**Step 4: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Successful compilation

**Step 5: Commit**

```bash
git add src-tauri/src/db/commit_store.rs src-tauri/src/db/mod.rs src-tauri/Cargo.toml
git commit -m "feat: add SQLite commit store for persistent commit history"
```

---

### Task 3: Add Tauri commands for commit operations

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add commit commands to commands.rs**

Add the following imports at the top of `src-tauri/src/commands.rs`, extending the existing `use crate::db::{...}` block to also include:

```rust
use crate::db::{
    // ... existing imports ...
    Commit, CommitChange, CommitDetail, CommitStore, SaveCommitChange, SaveCommitRequest,
};
```

Then add these command functions at the end of `src-tauri/src/commands.rs` (before the closing of the file, after the `get_database_info` function):

```rust
// ============================================================================
// Commit History Commands
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveCommitCommandRequest {
    pub project_id: String,
    pub message: String,
    pub summary: String,
    pub changes: Vec<SaveCommitChange>,
}

#[tauri::command]
pub fn save_commit(request: SaveCommitCommandRequest) -> Result<Commit> {
    CommitStore::save_commit(SaveCommitRequest {
        project_id: request.project_id,
        message: request.message,
        summary: request.summary,
        changes: request.changes,
    }).map_err(|e| crate::error::DbViewerError::Configuration(e))
}

#[tauri::command]
pub fn get_commits(project_id: String) -> Result<Vec<Commit>> {
    CommitStore::get_commits(&project_id)
        .map_err(|e| crate::error::DbViewerError::Configuration(e))
}

#[tauri::command]
pub fn get_commit_detail(project_id: String, commit_id: String) -> Result<CommitDetail> {
    CommitStore::get_commit_detail(&project_id, &commit_id)
        .map_err(|e| crate::error::DbViewerError::Configuration(e))
}
```

**Step 2: Register the commands in lib.rs**

In `src-tauri/src/lib.rs`, add these three lines to the `invoke_handler` block (after line 79 `commands::get_database_info,`):

```rust
            // Commit history commands
            commands::save_commit,
            commands::get_commits,
            commands::get_commit_detail,
```

**Step 3: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Successful compilation

**Step 4: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "feat: add Tauri commands for commit save/list/detail"
```

---

### Task 4: Add TypeScript types and frontend hooks for commits

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/hooks/useDatabase.ts`

**Step 1: Add commit types to index.ts**

Add at the end of `src/types/index.ts` (after the `Command` interface):

```typescript
// Commit history
export interface CommitRecord {
  id: string;
  parent_id: string | null;
  message: string;
  summary: string;
  created_at: string;
  change_count: number;
}

export interface CommitChangeRecord {
  id: number;
  commit_id: string;
  type: "insert" | "update" | "delete";
  schema_name: string;
  table_name: string;
  data: string;       // JSON string
  original_data: string | null; // JSON string
  sql: string;
  sort_order: number;
}

export interface CommitDetail {
  commit: CommitRecord;
  changes: CommitChangeRecord[];
}
```

**Step 2: Add commit hooks to useDatabase.ts**

Add at the end of `src/hooks/useDatabase.ts` (before the closing of the file), after the `deletePassword` function:

```typescript
// Commit history hooks
export function useSaveCommit() {
  return useMutation({
    mutationFn: async (params: {
      projectId: string;
      message: string;
      summary: string;
      changes: {
        type: string;
        schema_name: string;
        table_name: string;
        data: string;
        original_data: string | null;
        sql: string;
      }[];
    }) => {
      return invoke<CommitRecord>("save_commit", {
        request: {
          project_id: params.projectId,
          message: params.message,
          summary: params.summary,
          changes: params.changes,
        },
      });
    },
  });
}

export function useCommitHistory(projectId: string | null) {
  return useQuery({
    queryKey: ["commitHistory", projectId],
    queryFn: async () => {
      if (!projectId) throw new Error("No project selected");
      return invoke<CommitRecord[]>("get_commits", { projectId });
    },
    enabled: !!projectId,
  });
}

export function useCommitDetail(projectId: string | null, commitId: string | null) {
  return useQuery({
    queryKey: ["commitDetail", projectId, commitId],
    queryFn: async () => {
      if (!projectId || !commitId) throw new Error("Missing project or commit ID");
      return invoke<CommitDetail>("get_commit_detail", { projectId, commitId });
    },
    enabled: !!projectId && !!commitId,
  });
}
```

Also add the import for the new types at the top of `src/hooks/useDatabase.ts` — extend the existing import from `"../types"`:

```typescript
import type { Schema, TableData, Row, ConnectionConfig, SortColumn, FilterCondition, CommitRecord, CommitDetail } from "../types";
```

**Step 3: Verify it compiles**

Run: `cd /Users/jad/Documents/Projects/tusker && npx tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/types/index.ts src/hooks/useDatabase.ts
git commit -m "feat: add TypeScript types and hooks for commit history"
```

---

### Task 5: Create the ChangeCard component (human-readable diff view)

This is the core visual component shared between staged changes and commit history.

**Files:**
- Create: `src/components/commits/ChangeCard.tsx`

**Step 1: Create the ChangeCard component**

Create `src/components/commits/ChangeCard.tsx`:

```tsx
import { useState } from "react";
import { X, ChevronDown, ChevronRight, Code } from "lucide-react";
import { cn } from "../../lib/utils";
import type { Row } from "../../types";

interface ChangeCardProps {
  type: "insert" | "update" | "delete";
  schema: string;
  table: string;
  data: Row;
  originalData?: Row;
  sql: string;
  onRemove?: () => void; // Optional — not shown in history view
}

const TYPE_CONFIG = {
  insert: {
    badge: "bg-green-500/20 text-green-400",
    border: "border-green-500/20",
    bg: "bg-green-500/5",
    label: "INSERT",
    rowBg: "bg-green-500/8",
  },
  update: {
    badge: "bg-amber-500/20 text-amber-400",
    border: "border-amber-500/20",
    bg: "bg-amber-500/5",
    label: "UPDATE",
    rowBg: "",
  },
  delete: {
    badge: "bg-red-500/20 text-red-400",
    border: "border-red-500/20",
    bg: "bg-red-500/5",
    label: "DELETE",
    rowBg: "bg-red-500/8",
  },
};

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function ChangeCard({ type, schema, table, data, originalData, sql, onRemove }: ChangeCardProps) {
  const [showSql, setShowSql] = useState(false);
  const config = TYPE_CONFIG[type];

  return (
    <div className={cn("rounded-lg border p-4", config.bg, config.border)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={cn("px-2 py-0.5 rounded text-xs font-mono font-medium", config.badge)}>
            {config.label}
          </span>
          <span className="text-sm text-[var(--text-secondary)]">
            {schema}.{table}
          </span>
        </div>
        {onRemove && (
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
        )}
      </div>

      {/* Body — depends on type */}
      {type === "update" && originalData ? (
        <UpdateDiffTable data={data} originalData={originalData} />
      ) : type === "insert" ? (
        <PropertyTable data={data} variant="insert" />
      ) : (
        <PropertyTable data={data} variant="delete" />
      )}

      {/* Show SQL toggle */}
      <button
        onClick={() => setShowSql(!showSql)}
        className={cn(
          "flex items-center gap-1.5 mt-3 px-2 py-1 rounded text-xs",
          "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
          "hover:bg-[var(--bg-tertiary)]",
          "transition-colors duration-150"
        )}
      >
        {showSql ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Code className="w-3 h-3" />
        <span>SQL</span>
      </button>
      {showSql && (
        <pre className={cn(
          "mt-2 text-xs font-mono p-3 rounded-md overflow-x-auto",
          "bg-[var(--bg-primary)] text-[var(--text-primary)]",
          "border border-[var(--border-color)]"
        )}>
          {sql}
        </pre>
      )}
    </div>
  );
}

/** UPDATE: Field-by-field comparison table showing only changed fields */
function UpdateDiffTable({ data, originalData }: { data: Row; originalData: Row }) {
  // Find only the fields that changed
  const changedFields = Object.keys(data).filter((key) => {
    const oldVal = formatCellValue(originalData[key]);
    const newVal = formatCellValue(data[key]);
    return oldVal !== newVal;
  });

  if (changedFields.length === 0) {
    return (
      <div className="text-xs text-[var(--text-muted)] italic">No visible changes</div>
    );
  }

  return (
    <div className="rounded-md border border-[var(--border-color)] overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[var(--bg-tertiary)]">
            <th className="text-left px-3 py-1.5 font-medium text-[var(--text-secondary)] w-1/4">Field</th>
            <th className="text-left px-3 py-1.5 font-medium text-red-400 w-[37.5%]">Before</th>
            <th className="text-left px-3 py-1.5 font-medium text-green-400 w-[37.5%]">After</th>
          </tr>
        </thead>
        <tbody>
          {changedFields.map((field) => (
            <tr key={field} className="border-t border-[var(--border-color)]">
              <td className="px-3 py-1.5 font-mono text-[var(--text-secondary)]">{field}</td>
              <td className="px-3 py-1.5 font-mono bg-red-500/8 text-red-300">
                {formatCellValue(originalData[field])}
              </td>
              <td className="px-3 py-1.5 font-mono bg-green-500/8 text-green-300">
                {formatCellValue(data[field])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** INSERT/DELETE: Property list of row fields */
function PropertyTable({ data, variant }: { data: Row; variant: "insert" | "delete" }) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined);
  const bgClass = variant === "insert" ? "bg-green-500/8" : "bg-red-500/8";
  const textClass = variant === "insert" ? "text-green-300" : "text-red-300";

  if (entries.length === 0) {
    return <div className="text-xs text-[var(--text-muted)] italic">Empty row</div>;
  }

  return (
    <div className="rounded-md border border-[var(--border-color)] overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[var(--bg-tertiary)]">
            <th className="text-left px-3 py-1.5 font-medium text-[var(--text-secondary)] w-1/3">Field</th>
            <th className="text-left px-3 py-1.5 font-medium text-[var(--text-secondary)] w-2/3">Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([field, value]) => (
            <tr key={field} className={cn("border-t border-[var(--border-color)]", bgClass)}>
              <td className="px-3 py-1.5 font-mono text-[var(--text-secondary)]">{field}</td>
              <td className={cn("px-3 py-1.5 font-mono", textClass)}>
                {formatCellValue(value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 2: Verify it compiles**

Run: `cd /Users/jad/Documents/Projects/tusker && npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/components/commits/ChangeCard.tsx
git commit -m "feat: add ChangeCard component with diff table view"
```

---

### Task 6: Redesign the StagedChangesModal

**Files:**
- Modify: `src/components/modals/StagedChangesModal.tsx`

**Step 1: Rewrite StagedChangesModal with new card design and commit message flow**

Replace the entire contents of `src/components/modals/StagedChangesModal.tsx`:

```tsx
import { useEffect, useRef, useCallback, useState } from "react";
import { X, Trash2, Play, AlertCircle, Loader2, MessageSquare } from "lucide-react";
import { Button } from "../ui/Button";
import { useChangesStore } from "../../stores/changesStore";
import { useProjectStore } from "../../stores/projectStore";
import { useUIStore } from "../../stores/uiStore";
import { useCommitChanges, useSaveCommit } from "../../hooks/useDatabase";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "../../lib/utils";
import { ChangeCard } from "../commits/ChangeCard";
import type { StagedChange } from "../../types";

/** Generate a human-readable summary of changes */
function generateSummary(changes: StagedChange[]): string {
  const counts: Record<string, number> = {};
  const tables = new Set<string>();

  for (const c of changes) {
    counts[c.type] = (counts[c.type] || 0) + 1;
    tables.add(`${c.schema}.${c.table}`);
  }

  const parts: string[] = [];
  if (counts.insert) parts.push(`${counts.insert} insert${counts.insert > 1 ? "s" : ""}`);
  if (counts.update) parts.push(`${counts.update} update${counts.update > 1 ? "s" : ""}`);
  if (counts.delete) parts.push(`${counts.delete} delete${counts.delete > 1 ? "s" : ""}`);

  const tableList = Array.from(tables).join(", ");
  return `${parts.join(", ")} on ${tableList}`;
}

export function StagedChangesModal() {
  const { stagedChangesOpen, toggleStagedChanges, showToast } = useUIStore();
  const { changes, removeChange, clearChanges } = useChangesStore();
  const activeProject = useProjectStore((s) => s.getActiveProject());
  const drawerRef = useRef<HTMLDivElement>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [showCommitInput, setShowCommitInput] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const messageInputRef = useRef<HTMLInputElement>(null);

  const commitChanges = useCommitChanges();
  const saveCommit = useSaveCommit();
  const queryClient = useQueryClient();

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showCommitInput) {
          setShowCommitInput(false);
          setCommitMessage("");
        } else if (stagedChangesOpen) {
          toggleStagedChanges();
        }
      }
    },
    [stagedChangesOpen, showCommitInput, toggleStagedChanges]
  );

  useEffect(() => {
    if (stagedChangesOpen) {
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [stagedChangesOpen, handleEscape]);

  useEffect(() => {
    if (showCommitInput && messageInputRef.current) {
      messageInputRef.current.focus();
    }
  }, [showCommitInput]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      toggleStagedChanges();
    }
  };

  const summary = generateSummary(changes);

  const handleCommitClick = () => {
    setShowCommitInput(true);
    setCommitError(null);
  };

  const handleCommitConfirm = async () => {
    setCommitError(null);
    const queries = changes.map((c) => c.sql);
    const finalMessage = commitMessage.trim() || summary;

    try {
      // 1. Execute the SQL changes
      await commitChanges.mutateAsync(queries);

      // 2. Save to commit history (if project is available)
      if (activeProject) {
        try {
          await saveCommit.mutateAsync({
            projectId: activeProject.id,
            message: finalMessage,
            summary,
            changes: changes.map((c) => ({
              type: c.type,
              schema_name: c.schema,
              table_name: c.table,
              data: JSON.stringify(c.data),
              original_data: c.originalData ? JSON.stringify(c.originalData) : null,
              sql: c.sql,
            })),
          });
          // Invalidate commit history cache
          queryClient.invalidateQueries({ queryKey: ["commitHistory"] });
        } catch {
          // Commit history save failed, but SQL was already executed — don't block
          console.error("Failed to save commit to history");
        }
      }

      // 3. Clean up
      clearChanges();
      setShowCommitInput(false);
      setCommitMessage("");
      toggleStagedChanges();
      showToast(`Committed ${changes.length} change${changes.length !== 1 ? "s" : ""}`, "success");
    } catch (err) {
      let errorMessage: string;
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "string") {
        errorMessage = err;
      } else if (typeof err === "object" && err !== null) {
        const errObj = err as Record<string, unknown>;
        errorMessage = (errObj.message || errObj.error || errObj.description || JSON.stringify(err, null, 2)) as string;
      } else {
        errorMessage = "Failed to commit changes";
      }
      setCommitError(errorMessage);
    }
  };

  const handleCommitCancel = () => {
    setShowCommitInput(false);
    setCommitMessage("");
    setCommitError(null);
  };

  const handleDiscardAll = () => {
    clearChanges();
    setCommitError(null);
    setShowCommitInput(false);
    setCommitMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCommitConfirm();
    }
  };

  if (!stagedChangesOpen) return null;

  const isPending = commitChanges.isPending || saveCommit.isPending;

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
              <ChangeCard
                key={change.id}
                type={change.type}
                schema={change.schema}
                table={change.table}
                data={change.data}
                originalData={change.originalData}
                sql={change.sql}
                onRemove={() => removeChange(change.id)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        {changes.length > 0 && (
          <div className="px-6 py-4 border-t border-[var(--border-color)]">
            {commitError && (
              <div className="mb-3 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm max-h-32 overflow-y-auto">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <pre className="whitespace-pre-wrap break-words font-mono text-xs flex-1">{commitError}</pre>
                </div>
              </div>
            )}

            {showCommitInput ? (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <label className="text-xs font-medium text-[var(--text-secondary)]">Commit message</label>
                  </div>
                  <input
                    ref={messageInputRef}
                    type="text"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe your changes (optional)"
                    disabled={isPending}
                    className={cn(
                      "w-full px-3 py-2 rounded-md text-sm",
                      "bg-[var(--bg-primary)] text-[var(--text-primary)]",
                      "border border-[var(--border-color)]",
                      "placeholder:text-[var(--text-muted)]",
                      "focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]",
                      "disabled:opacity-50"
                    )}
                  />
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {summary}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCommitCancel}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleCommitConfirm}
                    disabled={isPending}
                    iconLeft={isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  >
                    {isPending ? "Committing..." : "Commit"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDiscardAll}
                  disabled={isPending}
                  iconLeft={<Trash2 className="w-4 h-4" />}
                >
                  Discard All
                </Button>
                <Button
                  variant="primary"
                  onClick={handleCommitClick}
                  disabled={isPending}
                  iconLeft={<Play className="w-4 h-4" />}
                >
                  Commit Changes
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify it compiles**

Run: `cd /Users/jad/Documents/Projects/tusker && npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/components/modals/StagedChangesModal.tsx
git commit -m "feat: redesign StagedChangesModal with human-readable diff cards and commit message"
```

---

### Task 7: Add "history" tab type and create CommitHistoryTab component

**Files:**
- Modify: `src/types/index.ts` (Tab type union)
- Create: `src/components/tabs/CommitHistoryTab.tsx`
- Modify: `src/components/layout/TabContent.tsx`

**Step 1: Extend the Tab type**

In `src/types/index.ts`, change the `Tab` interface's `type` field (line 120) from:

```typescript
  type: "table" | "query" | "create-table" | "edit-table" | "import-data";
```

to:

```typescript
  type: "table" | "query" | "create-table" | "edit-table" | "import-data" | "history";
```

**Step 2: Create CommitHistoryTab**

Create `src/components/tabs/CommitHistoryTab.tsx`:

```tsx
import { useState } from "react";
import { History, GitCommitHorizontal, AlertCircle, Loader2 } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useCommitHistory, useCommitDetail } from "../../hooks/useDatabase";
import { ChangeCard } from "../commits/ChangeCard";
import { cn } from "../../lib/utils";
import type { Tab, Row } from "../../types";

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

export function CommitHistoryTab({ tab: _tab }: { tab: Tab }) {
  const activeProject = useProjectStore((s) => s.getActiveProject());
  const projectId = activeProject?.id ?? null;
  const { data: commits, isLoading, error } = useCommitHistory(projectId);
  const [selectedCommitId, setSelectedCommitId] = useState<string | null>(null);

  const { data: commitDetail, isLoading: detailLoading } = useCommitDetail(projectId, selectedCommitId);

  if (!activeProject) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-[var(--text-secondary)]">No project selected</p>
          <p className="text-sm text-[var(--text-muted)]">Connect to a database to view commit history</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-400">Failed to load commit history</p>
          <p className="text-sm text-[var(--text-muted)]">{String(error)}</p>
        </div>
      </div>
    );
  }

  if (!commits || commits.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <History className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-[var(--text-secondary)]">No commits yet</p>
          <p className="text-sm text-[var(--text-muted)]">
            Your commit history will appear here after your first commit
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Left panel: Commit log */}
      <div className={cn(
        "w-80 shrink-0 border-r border-[var(--border-color)]",
        "overflow-y-auto bg-[var(--bg-primary)]"
      )}>
        <div className="px-4 py-3 border-b border-[var(--border-color)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <History className="w-4 h-4" />
            Commits
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {commits.length} commit{commits.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="divide-y divide-[var(--border-color)]">
          {commits.map((commit) => (
            <button
              key={commit.id}
              onClick={() => setSelectedCommitId(commit.id)}
              className={cn(
                "w-full text-left px-4 py-3",
                "hover:bg-[var(--bg-tertiary)]",
                "transition-colors duration-150",
                selectedCommitId === commit.id && "bg-[var(--bg-tertiary)]"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <GitCommitHorizontal className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                <code className="text-xs font-mono text-[var(--accent-color)]">
                  {commit.id.slice(0, 7)}
                </code>
                <span
                  className="text-xs text-[var(--text-muted)] ml-auto"
                  title={formatDate(commit.created_at)}
                >
                  {timeAgo(commit.created_at)}
                </span>
              </div>
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                {commit.message}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-[var(--text-muted)]">{commit.summary}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right panel: Commit detail */}
      <div className="flex-1 overflow-y-auto bg-[var(--bg-primary)]">
        {!selectedCommitId ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <GitCommitHorizontal className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-[var(--text-secondary)]">Select a commit to view details</p>
            </div>
          </div>
        ) : detailLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
          </div>
        ) : commitDetail ? (
          <div className="p-6">
            {/* Commit header */}
            <div className="mb-6 pb-4 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-3 mb-2">
                <GitCommitHorizontal className="w-5 h-5 text-[var(--accent-color)]" />
                <code className="text-sm font-mono text-[var(--accent-color)]">
                  {commitDetail.commit.id.slice(0, 7)}
                </code>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                  {commitDetail.commit.change_count} change{commitDetail.commit.change_count !== 1 ? "s" : ""}
                </span>
              </div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                {commitDetail.commit.message}
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                {formatDate(commitDetail.commit.created_at)}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">
                Full hash: {commitDetail.commit.id}
              </p>
            </div>

            {/* Change cards */}
            <div className="space-y-3">
              {commitDetail.changes.map((change) => {
                let data: Row;
                let originalData: Row | undefined;
                try {
                  data = JSON.parse(change.data);
                } catch {
                  data = {};
                }
                try {
                  originalData = change.original_data ? JSON.parse(change.original_data) : undefined;
                } catch {
                  originalData = undefined;
                }

                return (
                  <ChangeCard
                    key={change.id}
                    type={change.type}
                    schema={change.schema_name}
                    table={change.table_name}
                    data={data}
                    originalData={originalData}
                    sql={change.sql}
                  />
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
```

**Step 3: Add the history tab rendering to TabContent**

In `src/components/layout/TabContent.tsx`, add an import at the top (near line 68, after the `QueryTab` import):

```typescript
import { CommitHistoryTab } from "../tabs/CommitHistoryTab";
```

Then in the tab rendering logic (around line 3851-3853), add after the `query` branch:

```typescript
        } else if (tab.type === "history") {
          content = <CommitHistoryTab key={tab.id} tab={tab} />;
        }
```

**Step 4: Verify it compiles**

Run: `cd /Users/jad/Documents/Projects/tusker && npx tsc --noEmit`
Expected: No type errors

**Step 5: Commit**

```bash
git add src/types/index.ts src/components/tabs/CommitHistoryTab.tsx src/components/layout/TabContent.tsx
git commit -m "feat: add CommitHistoryTab with two-panel commit log and detail view"
```

---

### Task 8: Add history tab opener to UI store and status bar

**Files:**
- Modify: `src/stores/uiStore.ts`
- Modify: `src/components/layout/StatusBar.tsx`

**Step 1: Add addHistoryTab action to uiStore**

In `src/stores/uiStore.ts`, add `addHistoryTab` to the interface (after `addQueryTab` around line 97):

```typescript
  addHistoryTab: () => void;
```

Then add the implementation (after the `addQueryTab` implementation, around line 376):

```typescript
  addHistoryTab: () =>
    set((state) => {
      // Only allow one history tab
      const existing = state.tabs.find((t) => t.type === "history");
      if (existing) {
        return { activeTabId: existing.id };
      }
      const newTab: Tab = {
        id: `history-${Date.now()}`,
        type: "history",
        title: "Commit History",
      };
      return {
        tabs: [...state.tabs, newTab],
        activeTabId: newTab.id,
      };
    }),
```

**Step 2: Add History button to StatusBar**

In `src/components/layout/StatusBar.tsx`, add the `History` icon import (extend the lucide-react import):

```typescript
import { Circle, Database, FileEdit, History, Loader2 } from "lucide-react";
```

Then in the right section of the StatusBar (around line 131), add a History button before the staged changes button:

```tsx
      {/* Right section - History & Staged changes */}
      <div className="flex items-center gap-3">
        {connectionStatus === "connected" && (
          <button
            onClick={addHistoryTab}
            className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded",
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              "hover:bg-[var(--bg-tertiary)]",
              "transition-colors duration-150"
            )}
            title="Commit History"
          >
            <History className="w-3 h-3" />
            <span>History</span>
          </button>
        )}
        {changesCount > 0 && (
```

Also add the `addHistoryTab` hook at the top of the `StatusBar` component (after the existing hooks, around line 53):

```typescript
  const addHistoryTab = useUIStore((state) => state.addHistoryTab);
```

And import `useProjectStore` connection status check — `connectionStatus` is already available since it's already imported and used.

**Step 3: Verify it compiles**

Run: `cd /Users/jad/Documents/Projects/tusker && npx tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/stores/uiStore.ts src/components/layout/StatusBar.tsx
git commit -m "feat: add History button to status bar and history tab opener"
```

---

### Task 9: Build and test the complete feature end-to-end

**Step 1: Build the Rust backend**

Run: `cd /Users/jad/Documents/Projects/tusker/src-tauri && cargo build`
Expected: Successful build

**Step 2: Build the frontend**

Run: `cd /Users/jad/Documents/Projects/tusker && npm run build`
Expected: Successful build with no errors

**Step 3: Run the app in dev mode**

Run: `cd /Users/jad/Documents/Projects/tusker && npm run tauri dev`
Expected: App opens successfully

**Step 4: Manual testing checklist**

1. Connect to a database
2. Open a table and edit a cell — verify staged change appears in status bar
3. Click "Review" — verify the StagedChangesModal opens with human-readable change cards:
   - UPDATE shows field-by-field diff table (Before/After columns)
   - "Show SQL" toggle reveals raw SQL
4. Add a new row (INSERT) — verify it shows as a property list with green tint
5. Delete a row — verify it shows as a property list with red tint
6. Click "Commit Changes" — verify commit message input appears
7. Type a message and click "Commit" — verify:
   - Changes execute successfully
   - Toast shows "Committed N changes"
   - Modal closes
8. Click "History" in status bar — verify history tab opens
9. Verify the commit appears in the left panel with hash, message, summary, timestamp
10. Click the commit — verify right panel shows the change cards

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete commits UI redesign with diff view and history"
```

---

## File Summary

### New files:
- `src-tauri/src/db/commit_store.rs` — SQLite commit storage (Rust)
- `src/components/commits/ChangeCard.tsx` — Human-readable change card component
- `src/components/tabs/CommitHistoryTab.tsx` — Commit history tab with two-panel layout

### Modified files:
- `src-tauri/Cargo.toml` — Add rusqlite, sha2, dirs dependencies
- `src-tauri/src/db/mod.rs` — Register commit_store module
- `src-tauri/src/commands.rs` — Add save_commit, get_commits, get_commit_detail commands
- `src-tauri/src/lib.rs` — Register new Tauri commands
- `src/types/index.ts` — Add commit types and "history" tab type
- `src/hooks/useDatabase.ts` — Add commit history hooks
- `src/stores/uiStore.ts` — Add addHistoryTab action
- `src/components/modals/StagedChangesModal.tsx` — Full redesign with ChangeCard + commit message flow
- `src/components/layout/StatusBar.tsx` — Add History button
- `src/components/layout/TabContent.tsx` — Render history tab type
