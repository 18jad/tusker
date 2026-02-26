# Schema Diagram Feature Design

**Goal:** Interactive node-based visual diagram showing the full database schema — tables, columns, foreign key relationships, and constraints — rendered in a draggable, zoomable canvas.

**Approach:** React Flow + Dagre auto-layout. Custom table nodes with full column detail. Edges represent FK relationships. Toolbar with search, schema filter, fit-view, and PNG export.

**Tech:** `@xyflow/react`, `@dagrejs/dagre`

---

## 1. Architecture & Component Structure

New tab type `"diagram"` added to the `Tab` union. Opens from sidebar context menu, command palette, or keyboard shortcut.

### Files

```
src/components/diagram/
├── DiagramTab.tsx          # Main container — fetches data, builds nodes/edges
├── TableNode.tsx           # Custom React Flow node for a table
├── SchemaEdge.tsx          # Custom edge with FK label on hover
├── DiagramToolbar.tsx      # Search, schema filter, fit-view, export PNG
├── useAutoLayout.ts        # Dagre layout hook
└── diagramUtils.ts         # Color mapping, node/edge builders
```

### Data Flow

1. User opens diagram tab
2. `DiagramTab` reads `schemas` from `projectStore` (already loaded)
3. Fires parallel `get_columns()` IPC calls for every table (React Query cached)
4. From column data, builds React Flow nodes (one per table) and edges (one per FK)
5. Dagre computes node positions
6. React Flow renders interactive canvas

No new backend commands needed — existing `get_columns()` returns FK info, PK flags, types, and enum values.

---

## 2. Table Node Component

Always shows full column detail:

```
┌─────────────────────────────────┐
│  public.users              12k  │  ← schema.table + row count
├─────────────────────────────────┤
│  🔑 id          serial    PK   │  ← Primary key
│  •  name        varchar(100)   │  ← Regular column
│  •  email       varchar(255)   │
│  🔗 role_id     int4      FK → │  ← Foreign key (source handle)
│  •  created_at  timestamptz    │
│  •  status      user_status    │  ← Enum (tooltip shows values)
└─────────────────────────────────┘
```

### Visual Style

- Dark theme: `var(--bg-secondary)` background, `var(--border-color)` border
- Header has schema-colored left accent bar (like project cards on HomePage)
- Each schema gets a consistent color from a predefined palette
- Column rows: monospace font, alternating subtle background
- PK: key icon, bold name
- FK: link icon, right-side handle, slightly highlighted row
- Nullable: dimmed text
- Enum: tooltip with values on hover

### Handles

- Each FK column → source handle on right
- Each PK column → target handle on left
- Edges connect FK source → referenced PK target

---

## 3. Edges & Layout

### Edge Design

- Smooth bezier curves: FK column → referenced PK column
- Color matches source schema's color (subtle)
- Arrow marker at target end
- On hover: thickens + shows label like `fk_users_role_id → roles.id`
- Animated dash pattern on hover

### Dagre Auto-Layout

- Direction: left-to-right (`rankdir: "LR"`)
- Spacing: `nodesep: 80, ranksep: 200`
- Computed once on load; nodes freely draggable after
- "Reset Layout" button re-runs dagre

### Schema Grouping

- Same-schema tables positioned near each other
- Schema name labels as annotation nodes above each group

---

## 4. Toolbar & Interactions

### Toolbar

```
[🔍 Search tables...] [Schema: All ▾] [↺ Reset Layout] [⊞ Fit View] [📷 Export PNG]
```

- **Search**: Type-ahead filter, focuses/highlights matching nodes, dims others
- **Schema filter**: Multi-select dropdown to show/hide schemas
- **Reset Layout**: Re-runs dagre
- **Fit View**: Zooms to fit all visible nodes
- **Export PNG**: React Flow `toImage()` + Tauri save dialog

### Interactions

- **Click node header** → Opens table data tab
- **Hover node** → Highlights connected tables/edges, dims rest
- **Pan**: Click + drag background
- **Zoom**: Scroll wheel / pinch
- **Drag nodes**: Reposition freely
- **MiniMap**: Bottom-right, bird's-eye view colored by schema

### Access Points

1. Sidebar: right-click project → "Schema Diagram"
2. Command Palette: `Cmd+K` → "Open Schema Diagram"
3. Keyboard: `Cmd+Shift+D`

---

## 5. Data Loading & Performance

### Loading Strategy

1. `schemas` already in projectStore (table names + row counts)
2. Parallel `get_columns()` calls for all tables (React Query cached)
3. Extract FK relationships → build edges
4. Dagre layout (<50ms for 100 tables) → render

### Performance

- React Flow virtualizes 1000+ nodes
- Loading skeleton: "Loading schema diagram... (15/42 tables)"
- Failed column fetch → graceful degradation (show node with name only)
- Schema filter reduces visible nodes for large databases
- No persistence of node positions needed (dagre recomputes on each open)
