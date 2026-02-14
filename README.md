# Tusker

A modern, fast PostgreSQL database client built with Tauri, React, and TypeScript. Browse schemas, edit data, write queries, and manage your databases with a native interface.

| | | |
|:-------------------------:|:-------------------------:|:-------------------------:|
|<img width="1312" height="912" alt="image" src="https://github.com/user-attachments/assets/663cac93-7554-42dc-894d-93e7ab90bc41" />  Main Screen |  <img width="1312" height="912" alt="image" src="https://github.com/user-attachments/assets/da2731af-bf81-435f-9540-da873378d4d7" /> Table Browse | <img width="1312" height="912" alt="image" src="https://github.com/user-attachments/assets/980bd21f-5b65-42ef-b863-27a5e1762081" /> Git Diff Changes |
| <img width="1312" height="912" alt="image" src="https://github.com/user-attachments/assets/55a00f44-dd92-4dfa-ba91-40aad979cab6" /> Commits History | <img width="1312" height="912" alt="image" src="https://github.com/user-attachments/assets/3645b480-6cbd-43d7-9adb-31d50f5b3b4c" /> Fully Custom Table Builder | <img width="1312" height="912" alt="image" src="https://github.com/user-attachments/assets/1a9b4d8c-f790-431a-9a2e-83a296650e3a" /> SQL Playgound with autocomplete

## Features

### Type-Aware Inline Editing

Every cell editor adapts to the column's PostgreSQL data type — no generic text fields.

- **Numbers** — Dedicated numeric inputs with arrow-key increment/decrement for `integer`, `bigint`, `smallint`, `decimal`, `numeric`, `float`, `double precision`, `real`, and `money`
- **Booleans** — Dropdown toggle between `true`, `false`, and `NULL` for `boolean` columns
- **Dates & Timestamps** — Native date/time pickers for `date`, `time`, `timestamp`, and `timestamptz`
- **Enums** — Auto-detected PostgreSQL enum types rendered as searchable dropdown selects with all valid values
- **JSON / JSONB** — Expandable textarea editors for structured data
- **Arrays** — Tag-based array editors for any PostgreSQL array type (`text[]`, `int[]`, etc.) — add/remove items visually
- **Large Text** — Values over 500 characters are truncated in the grid with an expandable modal editor
- **NULL Handling** — Explicit NULL display and toggling across all types

### Foreign Key Lookups

Columns with foreign key constraints get a **searchable select dropdown** that queries the referenced table in real time. No more copying UUIDs or IDs by hand — just search and pick from the related records.

### Smart Column Detection

- **Serial / auto-increment columns** (`serial`, `bigserial`, `smallserial`, generated defaults) are automatically hidden when inserting new rows
- **Primary key indicators** shown directly in column headers
- **Column metadata** — data type, nullability, defaults, and constraints visible at a glance

### Advanced Filtering

Build multi-column filter rules with operators that adapt to each column type:

- **Text** — contains, not contains, equals, starts with, ends with, is null
- **Numbers** — `=`, `!=`, `>`, `<`, `>=`, `<=`, between, is null
- **Booleans** — is true, is false, is null
- **Dates** — equals, after, before, between, is null
- **Enums** — equals, not equals (with dropdown value picker)
- **UUID** — equals, not equals, is null
- **JSON / Arrays** — is null, is not null

Filters are persisted per table across sessions.

### Multi-Column Sorting

Click a column header to sort. **Shift+click** to add secondary, tertiary, and further sort levels. Sort direction, order, and state are persisted per table.

### Git-Like Change Management

Tusker tracks database changes with a commit-based workflow:

- **Staged Changes** — Queue inserts, updates, and deletes before applying them. Review everything in a dedicated "Staged Changes" tab
- **Commit History** — Every batch of changes is recorded with a message, timestamp, and full diff of before/after data
- **Commit Diff View** — Inspect exactly what changed in each commit, row by row
- **Instant Mode** — Optionally skip staging and apply changes immediately (configurable per project)

### Row Operations

- **Inline editing** — Double-click any cell to edit in place
- **Row detail modal** — Full-screen editor for viewing and editing all columns in a single row
- **Insert rows** — Add new rows with type-aware form inputs
- **Delete rows** — Delete individual or multi-selected rows (Shift+click / Cmd+click to select)
- **Bulk import** — Import from CSV or JSON files with column matching, data preview, and cell editing before commit

### SQL Playground

- Full **CodeMirror SQL editor** with PostgreSQL syntax highlighting and autocomplete
- Execute queries with **Cmd/Ctrl+Enter**
- View results in a data grid with execution time and rows-affected metrics
- **Query history** and **saved queries** for frequently used statements
- **SQL formatting** built in
- **Export results** to CSV or JSON

### Table Schema Builder

A visual UI for creating and modifying tables — no raw DDL needed:

- Add/remove columns with type selection from all PostgreSQL types
- Define primary keys, unique constraints, check constraints, and foreign keys
- Create indexes (B-tree, Hash, GiST, GIN, BRIN)
- Set default values and nullability
- **Live SQL preview** of the generated `CREATE TABLE` / `ALTER TABLE` statement

### Data Import & Export

- **Import** CSV or JSON files with auto-header detection, column mapping, data preview, and pre-import editing
- **Export** any table or query result to CSV or JSON via native file picker

### Multi-Project Connections

- Manage multiple PostgreSQL connections as color-coded projects
- SSL support (`disable`, `prefer`, `require`)
- Secure credential storage via the OS keychain
- Connection health checks with auto-reconnect
- Switch between projects instantly from the sidebar or command palette

> **Note:** Because database passwords are stored in the OS keychain, some systems may prompt you to enter your system password or approve keychain access when establishing a connection. This is expected behavior and ensures your credentials are stored securely.

### Keyboard-Driven Workflow

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + K` | Command palette |
| `Cmd/Ctrl + B` | Toggle sidebar |
| `Cmd/Ctrl + W` | Close active tab |
| `Cmd/Ctrl + N` | New table |
| `Cmd/Ctrl + T` | New query |
| `Double-click` | Edit cell |
| `Shift + Click` | Multi-select rows / add sort column |
| `Escape` | Close modals & popovers |

### Tabbed Interface

Open multiple tables, queries, imports, and schema editors side by side. Tabs are **draggable** (reorderable), **pinnable**, and support close/close-others/close-all.

### Schema Browser

Collapsible sidebar tree of all schemas, tables, views, materialized views, and foreign tables — with right-click context menus for quick operations (create, delete, truncate, export, rename).

### Track future features and bugs on our [Trello Board](https://trello.com/b/fdFwEise/tusker)

## Installation

Download the latest release from the [Releases page](https://github.com/18jad/tusker/releases/latest).

- **macOS** (Apple Silicon): `.dmg`
- **Windows**: `.exe` or `.msi`

### macOS: "App is damaged" warning
<img width="270" height="280" alt="image" src="https://github.com/user-attachments/assets/eb29e46f-2efe-4609-a66d-d38f64da68fd" />

The app is not code-signed with an Apple Developer certificate, so macOS Gatekeeper may block it. To fix this, run after installing:

```bash
xattr -cr /Applications/Tusker.app
```

Alternatively, right-click the app > **Open** > click **Open** again in the dialog. macOS will remember your choice.

## Development

### Prerequisites

- [Rust](https://rustup.rs/)
- [Bun](https://bun.sh/)
- **Linux only:** `libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`

### Setup

```bash
git clone https://github.com/18jad/tusker.git
cd tusker
bun install
bun tauri dev
```

### Build

```bash
bun tauri build
```

## Contributing

1. Fork the repository
2. Create a branch: `git checkout -b feature/your-feature`
3. Make your changes and test locally
4. Submit a Pull Request
