# Multi-Connection Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to open and operate on multiple database connections simultaneously.

**Architecture:** Replace the global singleton `currentConnectionId` with per-tab connection binding. The projectStore tracks multiple active connections, each with their own schemas and status. All hooks receive `connectionId` as a parameter instead of reading a global variable. The Rust backend already supports this — zero backend changes needed.

**Tech Stack:** React 19, TypeScript, Zustand v5, TanStack React Query v5, Tauri v2 IPC

---

### Task 1: Update Type Definitions

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add ConnectionState type and update Tab interface**

Add `ConnectionState` type after the `ConnectionStatus` type (~line 28):

```typescript
interface ConnectionState {
  connectionId: string
  status: ConnectionStatus
  schemas: Schema[]
  schemasLoading: boolean
  error: string | null
}
```

Add `connectionId` and `projectId` to the `Tab` interface (~line 117):

```typescript
interface Tab {
  id: string
  type: "table" | "query" | "create-table" | "edit-table" | "import-data" | "history" | "staged-changes" | "diagram"
  title: string
  connectionId: string   // NEW
  projectId: string      // NEW
  schema?: string
  table?: string
  queryContent?: string
  createTableSchema?: string
  importFormat?: "csv" | "json"
  filterKey?: string
  pinned?: boolean
}
```

**Step 2: Commit**

```
feat: add ConnectionState type and connectionId to Tab interface
```

---

### Task 2: Refactor projectStore for Multi-Connection

**Files:**
- Modify: `src/stores/projectStore.ts`

**Step 1: Replace single-connection state with multi-connection map**

Replace the state interface. Remove:
- `activeProjectId: string | null`
- `connectionStatus: ConnectionStatus`
- `schemas: Schema[]`
- `schemasLoading: boolean`
- `error: string | null`

Add:
- `connections: Record<string, ConnectionState>` — keyed by projectId

Replace the action signatures. Remove:
- `setActiveProject`
- `setConnectionStatus`
- `setSchemas`
- `setSchemasLoading`
- `setError`
- `getActiveProject`

Add:
- `connectProject: (projectId: string, connectionId: string) => void` — adds entry to connections map with status "connected"
- `disconnectProject: (projectId: string) => void` — removes entry from connections map
- `setProjectConnectionStatus: (projectId: string, status: ConnectionStatus) => void`
- `setProjectSchemas: (projectId: string, schemas: Schema[]) => void`
- `setProjectSchemasLoading: (projectId: string, loading: boolean) => void`
- `setProjectError: (projectId: string, error: string | null) => void`
- `getProject: (projectId: string) => Project | undefined`
- `getConnection: (projectId: string) => ConnectionState | undefined`
- `isProjectConnected: (projectId: string) => boolean`

**Step 2: Implement the new actions**

```typescript
connectProject: (projectId, connectionId) =>
  set((state) => ({
    connections: {
      ...state.connections,
      [projectId]: {
        connectionId,
        status: "connected",
        schemas: [],
        schemasLoading: false,
        error: null,
      },
    },
  })),

disconnectProject: (projectId) =>
  set((state) => {
    const { [projectId]: _, ...rest } = state.connections;
    return { connections: rest };
  }),

setProjectConnectionStatus: (projectId, status) =>
  set((state) => {
    const conn = state.connections[projectId];
    if (!conn) return state;
    return {
      connections: {
        ...state.connections,
        [projectId]: { ...conn, status },
      },
    };
  }),

setProjectSchemas: (projectId, schemas) =>
  set((state) => {
    const conn = state.connections[projectId];
    if (!conn) return state;
    return {
      connections: {
        ...state.connections,
        [projectId]: { ...conn, schemas },
      },
    };
  }),

setProjectSchemasLoading: (projectId, loading) =>
  set((state) => {
    const conn = state.connections[projectId];
    if (!conn) return state;
    return {
      connections: {
        ...state.connections,
        [projectId]: { ...conn, schemasLoading: loading },
      },
    };
  }),

setProjectError: (projectId, error) =>
  set((state) => {
    const conn = state.connections[projectId];
    if (!conn) return state;
    return {
      connections: {
        ...state.connections,
        [projectId]: { ...conn, error },
      },
    };
  }),

getProject: (projectId) => get().projects.find((p) => p.id === projectId),

getConnection: (projectId) => get().connections[projectId],

isProjectConnected: (projectId) => {
  const conn = get().connections[projectId];
  return conn?.status === "connected" || conn?.status === "reconnecting";
},
```

**Step 3: Update persist config**

The `connections` map should NOT be persisted (it's runtime state). Only `projects` should persist. Update the `partialize` option to exclude `connections`.

**Step 4: Commit**

```
refactor: convert projectStore to multi-connection model
```

---

### Task 3: Update uiStore for Connection-Scoped Tabs

**Files:**
- Modify: `src/stores/uiStore.ts`

**Step 1: Update tab creation functions to accept connectionId + projectId**

Every tab creation function needs `connectionId` and `projectId` params:

- `addTab(tab)` — Tab already has connectionId/projectId from the caller
- `addQueryTab(connectionId, projectId)` — pass through to tab object
- `addHistoryTab(connectionId, projectId)` — same
- `addStagedChangesTab(connectionId, projectId)` — same
- `addDiagramTab(connectionId, projectId, schema?)` — same
- `addImportDataTab(connectionId, projectId, schema, table, format)` — same
- `addCreateTableTab(connectionId, projectId, schema)` — same
- `addEditTableTab(connectionId, projectId, schema, table)` — same

**Step 2: Update state key helpers to scope by connectionId**

Change `tableKey` format from `"schema.table"` to `"connectionId::schema.table"` in:
- `setTableSort` / `getTableSort`
- `setTableFilters` / `getTableFilters`
- `setColumnWidth` / `getColumnWidths` / `resetColumnWidths`

**Step 3: Add closeTabsForConnection action**

```typescript
closeTabsForConnection: (connectionId: string) => void
```

Closes all tabs whose `connectionId` matches. Cleans up associated sort/filter/column state.

**Step 4: Add helper to get active tab's connection info**

```typescript
getActiveConnectionId: () => string | undefined
getActiveProjectId: () => string | undefined
```

Derives from `activeTabId` → find tab → return `tab.connectionId` / `tab.projectId`.

**Step 5: Commit**

```
refactor: scope uiStore tabs and state keys by connectionId
```

---

### Task 4: Update changesStore to Scope by Connection

**Files:**
- Modify: `src/stores/changesStore.ts`

**Step 1: Add connectionId to staged changes**

Add `connectionId` field to the `StagedChange` type in `types/index.ts`:

```typescript
interface StagedChange {
  id: string
  type: "insert" | "update" | "delete"
  connectionId: string  // NEW
  table: string
  schema: string
  data: Row
  originalData?: Row
  sql: string
}
```

**Step 2: Update addChange to include connectionId**

The `addChange` call receives `connectionId` in the change object. Merge logic checks same connectionId + same row.

**Step 3: Update getChangesForTable signature**

```typescript
getChangesForTable: (connectionId: string, schema: string, table: string) => StagedChange[]
```

Filter by connectionId in addition to schema/table.

**Step 4: Add clearChangesForConnection**

```typescript
clearChangesForConnection: (connectionId: string) => void
```

Removes all staged changes for a specific connection.

**Step 5: Commit**

```
refactor: scope changesStore by connectionId
```

---

### Task 5: Refactor useDatabase Hooks

**Files:**
- Modify: `src/hooks/useDatabase.ts`

This is the largest change. Every hook that uses `currentConnectionId` needs a `connectionId` parameter instead.

**Step 1: Remove the global singleton**

Delete these lines (~6-15):
```typescript
let currentConnectionId: string | null = null
export function getCurrentConnectionId() { ... }
export function setCurrentConnectionId(id: string | null) { ... }
```

**Step 2: Update useConnect**

Change signature to return the connectionId and accept projectId:
```typescript
export function useConnect() {
  // ... mutation that:
  // 1. Connects via invoke("connect", request)
  // 2. Calls projectStore.connectProject(projectId, result.connection_id)
  // 3. Fetches schemas via invoke("get_schemas_with_tables", { connectionId: result.connection_id })
  // 4. Calls projectStore.setProjectSchemas(projectId, schemas)
  // No longer sets a global variable
}
```

The `mutate` function receives `{ project, password? }` and uses `projectStore.connectProject()` instead of `setActiveProject()`.

**Step 3: Update useDisconnect**

```typescript
export function useDisconnect() {
  // Receives { projectId, connectionId }
  // 1. invoke("disconnect", { connectionId })
  // 2. projectStore.disconnectProject(projectId)
  // 3. uiStore.closeTabsForConnection(connectionId)
  // 4. changesStore.clearChangesForConnection(connectionId)
}
```

**Step 4: Update all data hooks to take connectionId parameter**

Every hook that calls `invoke()` with `connection_id` needs it as a param:

- `useSchemas(connectionId)` — query key: `["schemas", connectionId]`
- `useTableColumns(connectionId, schema, table)` — query key: `["tableColumns", connectionId, schema, table]`
- `useTableIndexes(connectionId, schema, table)` — query key: `["tableIndexes", connectionId, schema, table]`
- `useTableData(connectionId, schema, table, page, sorts, filters)` — query key: `["tableData", connectionId, schema, table, page, ...]`
- `useInsertRow()` — mutation receives connectionId in params
- `useUpdateRow()` — mutation receives connectionId in params
- `useDeleteRow()` — mutation receives connectionId in params
- `useExecuteQuery()` — mutation receives connectionId in params
- `useForeignKeyValues(connectionId, schema, table, column, searchQuery, limit)`
- `useCommitChanges()` — mutation receives connectionId in params
- `useMigration()` — mutation receives connectionId in params
- `useExecuteSQL()` — mutation receives connectionId in params, invalidates `["schemas", connectionId]`

The query key pattern is critical — React Query caches are now scoped per connection, so switching tabs auto-fetches correct data.

**Step 5: Commit**

```
refactor: pass connectionId to all database hooks, remove global singleton
```

---

### Task 6: Update useConnectionHealthCheck for Multi-Connection

**Files:**
- Modify: `src/hooks/useConnectionHealthCheck.ts`

**Step 1: Iterate over all active connections**

Instead of checking a single connection, iterate `projectStore.connections`:

```typescript
export function useConnectionHealthCheck() {
  const connections = useProjectStore((state) => state.connections);
  // For each connected project, set up an interval that:
  // 1. Pings via invoke("ping_database", { connectionId: conn.connectionId })
  // 2. On failure, attempts reconnect for THAT specific connection
  // 3. Updates status via setProjectConnectionStatus(projectId, status)
  // 4. On reconnect success, re-fetches schemas for that project
}
```

Use a ref to track intervals per projectId. Clean up intervals when a connection is removed.

**Step 2: Commit**

```
refactor: multi-connection health check with per-connection ping intervals
```

---

### Task 7: Refactor Sidebar for Multi-Connection Tree

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

This is the biggest UI change. The sidebar needs to show multiple connected projects.

**Step 1: Replace single ProjectTree with multi-connection list**

The sidebar body renders:
1. **Connected projects** — each as a collapsible section with schema tree
2. **Disconnected projects** — shown below with a "connect" action

For each connected project, render:
- Connection header: color dot + name + status indicator + collapse toggle
- Per-connection action buttons: [+ Query] [+ Table] [+ Diagram]
- Schema tree (existing `SchemaTree` component, but scoped to that project's schemas)
- Right-click context menu: Disconnect, Edit, etc.

For each disconnected project:
- Name with gray dot
- Click to connect

**Step 2: Update SchemaTree to accept connection props**

`SchemaTree` currently reads `schemas` from projectStore globally. Change it to receive props:

```typescript
interface SchemaTreeProps {
  projectId: string
  connectionId: string
  schemas: Schema[]
  projectColor: ProjectColor
}
```

When a table is clicked, `addTab()` includes the `connectionId` and `projectId`.

**Step 3: Update footer buttons (New Query / New Table)**

These global buttons should:
1. Check if there's an active tab → use that tab's connectionId/projectId
2. If no active tab, check if exactly one connection exists → use it
3. If multiple connections and no active tab → show a quick picker (small dropdown listing connected projects)

**Step 4: Commit**

```
feat: multi-connection sidebar with per-connection schema trees
```

---

### Task 8: Update AppLayout and Header

**Files:**
- Modify: `src/components/layout/AppLayout.tsx`

**Step 1: Simplify TitleBar**

Remove the `ProjectMenu` component that shows the single active project. Replace with a simpler header that:
- Shows app title
- Keeps Cmd+P shortcut for project spotlight
- Keeps Cmd+K for command palette
- Shows schema diagram button (needs a connection picker if multiple connections)

**Step 2: Update content rendering logic**

Current logic: `showTabContent = activeTabId && connectionStatus === "connected"`

New logic: `showTabContent = activeTabId !== null` — the tab itself knows its connection. If the tab's connection is disconnected, the tab content component handles showing an error state.

Show sidebar when at least one connection exists OR at least one project exists (so user can connect from sidebar). Show HomePage only when zero projects exist.

**Step 3: Update EmptyState**

When connected but no tab open, show a message based on the number of connections. If multiple, say "Select a table from the sidebar to get started".

**Step 4: Commit**

```
feat: update AppLayout for multi-connection support
```

---

### Task 9: Update TabContent and All Tab Components

**Files:**
- Modify: `src/components/layout/TabContent.tsx`

**Step 1: Pass connectionId from tab to all hooks**

In `TabContent`, each tab renderer reads `tab.connectionId` and passes it down:

```typescript
// For table tabs:
<TableTabContent
  connectionId={tab.connectionId}
  projectId={tab.projectId}
  schema={tab.schema!}
  table={tab.table!}
  filterKey={tab.filterKey}
/>
```

**Step 2: Update TableTabContent**

Add `connectionId` and `projectId` to props. Pass `connectionId` to:
- `useTableData(connectionId, schema, table, page, sorts, filters)`
- `useCommitChanges()` — pass connectionId when calling mutate
- `changesStore.getChangesForTable(connectionId, schema, table)`
- `changesStore.addChange({ connectionId, ... })`
- All other hooks called within

Read project settings (`readOnly`, `instantCommit`) from `projectStore.getProject(projectId)` instead of from `getActiveProject()`.

Update `tableKey` for sort/filter/column state to `"connectionId::schema.table"`.

**Step 3: Update CreateTableTabContent**

- Read schemas from `projectStore.getConnection(projectId)?.schemas` instead of global `schemas`
- Pass connectionId to `useMigration()` and `useExecuteSQL()`

**Step 4: Update EditTableTabContent**

- Pass connectionId to `useTableColumns()`, `useTableIndexes()`, `useMigration()`

**Step 5: Update QueryTab**

The query tab uses connectionId from `tab.connectionId` to execute queries. Pass to `useExecuteQuery()`.

**Step 6: Update remaining tab types**

- `CommitHistoryTab` — uses projectId from tab
- `StagedChangesTab` — filters changes by connectionId
- `DiagramTab` — reads schemas from connection state
- `ImportDataTab` — passes connectionId to data hooks

**Step 7: Update connection status check**

Current: `if (connectionStatus !== "connected") return null`

New: Check the specific tab's connection status:
```typescript
const connection = useProjectStore((s) => s.connections[tab.projectId]);
if (!connection || (connection.status !== "connected" && connection.status !== "reconnecting")) {
  return <DisconnectedTabState projectName={...} onReconnect={...} />;
}
```

This shows a helpful message instead of hiding the tab when its connection drops.

**Step 8: Commit**

```
feat: pass connectionId through all tab content components
```

---

### Task 10: Update ProjectSpotlight

**Files:**
- Modify: `src/components/ui/ProjectSpotlight.tsx`

**Step 1: Change from "switch" to "connect alongside"**

Replace `proceedWithProjectSwitch` logic:

Old: disconnect current → close all tabs → connect new
New: just connect the selected project (if not already connected)

```typescript
const handleSelectProject = (project: Project) => {
  const isConnected = projectStore.isProjectConnected(project.id);
  if (isConnected) {
    // Already connected — just close the spotlight
    closeProjectSpotlight();
    return;
  }
  // Connect alongside existing connections
  connect.mutate({ project });
  closeProjectSpotlight();
};
```

**Step 2: Update visual indicators**

Show "Connected" badge on projects that are currently connected (not just the single active one). Show connection status indicator per project.

**Step 3: Remove unsaved changes warning on "switch"**

Since we no longer disconnect when selecting a project, no data is lost. Remove the confirmation dialog for uncommitted changes.

**Step 4: Commit**

```
feat: ProjectSpotlight connects alongside existing connections
```

---

### Task 11: Update CommandPalette

**Files:**
- Modify: `src/components/ui/CommandPalette.tsx`

**Step 1: Generate commands per connected project**

Instead of checking a single `connectionStatus`, iterate over all connections:

```typescript
const connections = useProjectStore((s) => s.connections);
const projects = useProjectStore((s) => s.projects);

// For each connected project, add:
// - "New Query ({projectName})" → addQueryTab(connectionId, projectId)
// - "Open Schema Diagram ({projectName})" → addDiagramTab(connectionId, projectId)
// - "Disconnect {projectName}" → disconnect({ projectId, connectionId })

// For each table across all connections:
// - "Open {schema}.{table} ({projectName})" → addTab with connectionId
```

**Step 2: Add connect/disconnect commands**

For disconnected projects: "Connect to {projectName}"
For connected projects: "Disconnect {projectName}"

**Step 3: Commit**

```
feat: connection-aware command palette commands
```

---

### Task 12: Update HomePage

**Files:**
- Modify: `src/components/layout/HomePage.tsx`

**Step 1: Update ProjectCard click handler**

Change `handleClick` to connect alongside, not replace:

Old: disconnect → close tabs → clear changes → set active → connect
New: just connect

```typescript
const handleClick = () => {
  if (isConnected) return; // Already connected
  connect.mutate({ project });
};
```

**Step 2: Show connected state per card**

Each ProjectCard shows its own connection status. Multiple cards can show "Connected" simultaneously.

**Step 3: Decide when to show HomePage**

HomePage shows when there are zero projects OR when no connections are active. Once any connection is made, the sidebar + tab view takes over.

**Step 4: Commit**

```
feat: HomePage supports connecting multiple projects
```

---

### Task 13: Integration Testing and Polish

**Step 1: Manual testing checklist**

- [ ] Connect to one database — sidebar shows schema tree, can open table tabs
- [ ] Connect to a second database — sidebar shows both, tabs work independently
- [ ] Open tabs from different connections — tab headers show correct color/name
- [ ] Switch between tabs — data loads for correct connection
- [ ] Run query in tab — executes against correct connection
- [ ] Create table — uses correct connection
- [ ] Edit table — uses correct connection
- [ ] Stage changes — scoped to connection
- [ ] Disconnect one connection — only its tabs close, other connection unaffected
- [ ] Health check — one connection dropping doesn't affect the other
- [ ] Cmd+P spotlight — can connect additional projects
- [ ] Cmd+K palette — shows commands for all connections
- [ ] New Query/Table from sidebar buttons — context-correct
- [ ] New Query/Table from toolbar — defaults to active tab's connection

**Step 2: Final commit**

```
feat: multi-connection support complete
```
