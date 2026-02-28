# Multi-Connection Support Design

## Goal

Allow users to open and operate on multiple database connections simultaneously, replacing the current single-connection model.

## Current State

- Rust backend already supports multiple connections via `HashMap<String, ActiveConnection>`
- Frontend uses a global singleton `currentConnectionId` in `useDatabase.ts`
- All hooks, stores, and components assume one active connection
- Switching projects disconnects the current one and closes all tabs
- Zero backend changes required

## Design

### Sidebar — Multi-Connection Tree

The sidebar becomes a grouped connection tree:

- Each connected database is a collapsible section with its own schema tree
- Each connection section has **+ Query** and **+ Table** action buttons
- Disconnected projects still appear in the list — click to connect
- Right-click connection header for disconnect, reconnect, etc.
- Global toolbar "New Query" / "New Table" default to the active tab's connection; if no tab is open, a quick connection picker appears

### Tabs — Connection Binding

Every tab gets a `connectionId` field and displays its connection context:

- Tab header shows the connection's user-assigned color dot + connection name prefix
- Clicking a table in the sidebar opens a tab bound to that connection
- Query tabs run against their bound connection
- Tabs from different connections can coexist
- Closing all tabs from a connection does NOT disconnect it
- Disconnecting a connection closes its tabs (with unsaved changes warning)

### Data Flow

Replace the global singleton with per-tab connection resolution:

```
Old:  Tab -> hook(schema, table) -> global currentConnectionId -> Rust
New:  Tab -> hook(connectionId, schema, table) -> connectionId from tab -> Rust
```

- Remove module-level `currentConnectionId` from `useDatabase.ts`
- All query hooks receive `connectionId` as a parameter
- Active tab determines which connection is in context

### Store Changes

**projectStore**:
- Remove single `activeProjectId` / `connectionStatus`
- Add `connectedProjects: Record<projectId, { connectionId, status }>` to track multiple connections

**uiStore**:
- Add `connectionId` field to `Tab` interface
- Change state keys from `"schema.table"` to `"connectionId::schema.table"` for sort, column widths, filters

**changesStore**:
- Scope staged changes per `connectionId`

### Connection Lifecycle

- **Connect**: Click disconnected project -> connects alongside existing connections
- **Disconnect**: Right-click -> Disconnect. Closes that connection's tabs only.
- **Health checks**: Per-connection health check intervals. One dropping doesn't affect others.
- **Startup**: No auto-connect. User clicks to connect.
- **Cmd+P spotlight**: Becomes "connect to" action, not "switch to".

## Files to Modify

**Stores**:
- `src/stores/projectStore.ts` — multi-connection tracking
- `src/stores/uiStore.ts` — tab connectionId, scoped state keys
- `src/stores/changesStore.ts` — scope changes per connection

**Hooks**:
- `src/hooks/useDatabase.ts` — remove singleton, add connectionId param to all hooks
- `src/hooks/useConnectionHealthCheck.ts` — per-connection health checks

**Components**:
- `src/components/layout/Sidebar.tsx` — multi-connection tree with per-connection actions
- `src/components/layout/AppLayout.tsx` — remove single-project header, support multi-connection
- `src/components/layout/TabContent.tsx` — pass connectionId from tab to all child hooks
- `src/components/table/DataTable.tsx` — receive connectionId via props
- `src/components/ui/ProjectSpotlight.tsx` — "connect to" instead of "switch to"
- `src/components/ui/CommandPalette.tsx` — connection-aware commands
- All table/query components that call hooks
