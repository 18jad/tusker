<p align="center">                                                                      
    <img 
  src="https://github.com/user-attachments/assets/498af48e-be77-46b8-a240-b6ee2bc2016f"   
  width="128" height="128" alt="Tuskter Icon">                                          
  </p>

  <h1 align="center">Tusker</h1>

  <p align="center">
    <strong>A modern, fast PostgreSQL database client for macOS and Windows</strong>
  </p>

  <p align="center">
    <img 
  src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue?style=flat-square"
   alt="macOS | Windows">
    <img 
  src="https://img.shields.io/badge/built%20with-Tauri%202-orange?style=flat-square" 
  alt="Tauri 2">
 <img src="https://img.shields.io/badge/frontend-React%20%2B%20TypeScript-purple?style=flat-square" alt="React + TypeScript">
    <img src="https://img.shields.io/badge/database-PostgreSQL-336791?style=flat-square" 
  alt="PostgreSQL">
    <img 
  src="https://img.shields.io/github/v/release/18jad/tusker?style=flat-square&color=green"
   alt="Latest Release">
  </p>

  <p align="center">
    Browse schemas, edit data, write queries, and manage your databases with a native
  interface.
  </p>

  <p align="center">
    <a href="https://github.com/18jad/tusker/releases/latest">Download</a> · <a 
  href="https://trello.com/b/fdFwEise/tusker">Roadmap</a>
  </p>

  ---

  <table align="center">
    <tr>
      <td align="center"><img
  src="https://github.com/user-attachments/assets/663cac93-7554-42dc-894d-93e7ab90bc41"
  width="400" alt="Main Screen"><br><sub>Main Screen</sub></td>
      <td align="center"><img
  src="https://github.com/user-attachments/assets/da2731af-bf81-435f-9540-da873378d4d7"
  width="400" alt="Table Browse"><br><sub>Table Browse</sub></td>
    </tr>
    <tr>
      <td align="center"><img
  src="https://github.com/user-attachments/assets/980bd21f-5b65-42ef-b863-27a5e1762081"
  width="400" alt="Git Diff Changes"><br><sub>Git Diff Changes</sub></td>
      <td align="center"><img
  src="https://github.com/user-attachments/assets/55a00f44-dd92-4dfa-ba91-40aad979cab6"
  width="400" alt="Commits History"><br><sub>Commits History</sub></td>
    </tr>
    <tr>
      <td align="center"><img
  src="https://github.com/user-attachments/assets/3645b480-6cbd-43d7-9adb-31d50f5b3b4c"
  width="400" alt="Table Builder"><br><sub>Custom Table Builder</sub></td>
      <td align="center"><img
  src="https://github.com/user-attachments/assets/1a9b4d8c-f790-431a-9a2e-83a296650e3a"
  width="400" alt="SQL Playground"><br><sub>SQL Playground</sub></td>
    </tr>
  </table>

  ---

  ## Features

  ### Type-Aware Inline Editing
  > Every cell editor adapts to the column's PostgreSQL data type — no generic text fields

  - **Numbers** — Dedicated numeric inputs with arrow-key increment/decrement for
  `integer`, `bigint`, `smallint`, `decimal`, `numeric`, `float`, `double precision`,
  `real`, and `money`
  - **Booleans** — Dropdown toggle between `true`, `false`, and `NULL`
  - **Dates & Timestamps** — Native date/time pickers for `date`, `time`, `timestamp`, and
   `timestamptz`
  - **Enums** — Auto-detected PostgreSQL enum types rendered as searchable dropdown
  selects
  - **JSON / JSONB** — Expandable textarea editors for structured data
  - **Arrays** — Tag-based array editors for any PostgreSQL array type (`text[]`, `int[]`,
   etc.)
  - **Large Text** — Values over 500 characters are truncated with an expandable modal
  editor
  - **NULL Handling** — Explicit NULL display and toggling across all types

  ---

  ### Foreign Key Lookups
  > Columns with FK constraints get a searchable select dropdown that queries the
  referenced table in real time

  No more copying UUIDs or IDs by hand — just search and pick from the related records.

  ---

  ### Smart Column Detection

  - **Serial / auto-increment columns** (`serial`, `bigserial`, `smallserial`, generated
  defaults) are automatically hidden when inserting new rows
  - **Primary key indicators** shown directly in column headers
  - **Column metadata** — data type, nullability, defaults, and constraints visible at a
  glance

  ---

  ### Advanced Filtering
  > Build multi-column filter rules with operators that adapt to each column type

  | Type | Operators |
  |------|-----------|
  | **Text** | contains, not contains, equals, starts with, ends with, is null |
  | **Numbers** | `=`, `!=`, `>`, `<`, `>=`, `<=`, between, is null |
  | **Booleans** | is true, is false, is null |
  | **Dates** | equals, after, before, between, is null |
  | **Enums** | equals, not equals (with dropdown picker) |
  | **UUID** | equals, not equals, is null |
  | **JSON / Arrays** | is null, is not null |

  Filters are persisted per table across sessions.

  ---

  ### Multi-Column Sorting

  Click a column header to sort. **Shift+click** to add secondary, tertiary, and further
  sort levels. Sort direction, order, and state are persisted per table.

  ---

  ### Git-Like Change Management
  > Track database changes with a commit-based workflow

  - **Staged Changes** — Queue inserts, updates, and deletes before applying. Review
  everything in a dedicated tab
  - **Commit History** — Every batch of changes is recorded with a message, timestamp, and
   full diff
  - **Commit Diff View** — Inspect exactly what changed in each commit, row by row
  - **Instant Mode** — Optionally skip staging and apply changes immediately (configurable
   per project)

  ---

  ### Row Operations

  - **Inline editing** — Double-click any cell to edit in place
  - **Row detail modal** — Full-screen editor for all columns in a single row
  - **Insert rows** — Type-aware form inputs
  - **Delete rows** — Individual or multi-selected (Shift+click / Cmd+click)
  - **Bulk import** — CSV or JSON with column matching, data preview, and cell editing
  before commit

  ---

  ### SQL Playground
  > Full CodeMirror SQL editor with PostgreSQL syntax highlighting and autocomplete

  - Execute queries with **Cmd/Ctrl+Enter**
  - Results in a data grid with execution time and row count
  - **Query history** and **saved queries**
  - **SQL formatting** built in
  - **Export results** to CSV or JSON

  ---

  ### Table Schema Builder
  > A visual UI for creating and modifying tables — no raw DDL needed

  - Add/remove columns with type selection from all PostgreSQL types
  - Define primary keys, unique constraints, check constraints, and foreign keys
  - Create indexes (B-tree, Hash, GiST, GIN, BRIN)
  - Set default values and nullability
  - **Live SQL preview** of the generated `CREATE TABLE` / `ALTER TABLE` statement

  ---

  ### Data Import & Export

  - **Import** CSV or JSON with auto-header detection, column mapping, data preview, and
  pre-import editing
  - **Export** any table or query result to CSV or JSON via native file picker

  ---

  ### Multi-Project Connections

  - Manage multiple PostgreSQL connections as color-coded projects
  - SSL support (`disable`, `prefer`, `require`)
  - Secure credential storage via the OS keychain
  - Connection health checks with auto-reconnect
  - Switch between projects instantly from the sidebar or command palette

  > **Note:** Because database passwords are stored in the OS keychain, some systems may
  prompt you to enter your system password or approve keychain access when establishing a
  connection. This is expected behavior.

  ---

  ### Keyboard Shortcuts

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

  ---

  ### Tabbed Interface

  Open multiple tables, queries, imports, and schema editors side by side. Tabs are
  **draggable**, **pinnable**, and support close/close-others/close-all.

  ### Schema Browser

  Collapsible sidebar tree of all schemas, tables, views, materialized views, and foreign
  tables — with right-click context menus for quick operations.

  ---

  ## Installation

  Download the latest release from the [Releases
  page](https://github.com/18jad/tusker/releases/latest).

  | Platform | Format |
  |----------|--------|
  | **macOS** (Apple Silicon) | `.dmg` |
  | **Windows** | `.exe` / `.msi` |

  ### macOS: "App is damaged" warning

  <img width="270" height="280" alt="Gatekeeper warning" 
  src="https://github.com/user-attachments/assets/eb29e46f-2efe-4609-a66d-d38f64da68fd">

  The app is not code-signed with an Apple Developer certificate. To fix:

  ```bash
  xattr -cr /Applications/Tusker.app
  ```

  Or right-click the app > Open > click Open again in the dialog.

  ---
  Development

  Prerequisites

  - https://rustup.rs/
  - https://bun.sh/
  - Linux only: libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev libayatana-appindicator3-dev
   librsvg2-dev

  Setup

  git clone https://github.com/18jad/tusker.git
  cd tusker
  bun install
  bun tauri dev

  Build

  bun tauri build

  ---
  Contributing

  1. Fork the repository
  2. Create a branch: git checkout -b feature/your-feature
  3. Make your changes and test locally
  4. Submit a Pull Request
