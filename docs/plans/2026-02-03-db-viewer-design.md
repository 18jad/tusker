# DB Viewer - Design Document

## Overview
Cross-platform desktop PostgreSQL database viewer with excellent UI/UX.

## Tech Stack
- **Tauri 2.0** - Rust backend, native webview
- **React 18 + TypeScript** - Frontend
- **TailwindCSS** - Styling
- **Zustand** - State management
- **TanStack Query** - Server state & caching
- **sqlx** - Rust PostgreSQL driver

## Target Users
- Developers
- DBAs / Data Engineers
- Non-technical users (business analysts, support teams)

## Core Features (v1)

### Project Management
- Multiple saved projects (connections)
- Connect via form fields or connection string
- Color-coded projects
- Per-project settings (instant commit, read-only)
- Test connection before save

### Navigation
- Collapsible sidebar with project/schema/table tree
- Tabs for open tables and queries
- Command palette (Cmd+K)
- Keyboard shortcuts throughout

### Table View
- Spreadsheet-like data grid
- Pagination (50 rows per page)
- Resizable columns
- Type-aware cell rendering

### Data Editing
- Click-to-edit cells
- Staged changes by default (diff view)
- Optional instant commit per project
- Visual indicators (edited, new, deleted)
- Review panel showing SQL to execute

### UI/UX
- Dark theme default, light theme option
- Clean minimal aesthetic with professional density
- Smooth 60fps interactions
- Fast startup and navigation

## Architecture
```
React Frontend → Tauri IPC → Rust Backend → PostgreSQL
```

Credentials encrypted locally. No cloud dependency.
