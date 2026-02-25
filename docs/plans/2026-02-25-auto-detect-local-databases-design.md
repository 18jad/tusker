# Auto-Detect Local PostgreSQL Databases

## Problem

Users with local PostgreSQL databases must manually configure each connection in Tusker. This is tedious when multiple databases exist. pgAdmin solves this by auto-detecting local servers — Tusker should offer the same convenience.

## Design

### Detection Engine (Rust Backend)

New module: `src-tauri/src/db/discovery.rs`

**Discovery phases:**

1. **Socket Scan** — Read `/tmp` and `/var/run/postgresql` for `.s.PGSQL.<port>` files. Each hit = a running PostgreSQL instance with a known port.

2. **TCP Fallback** — Probe `localhost` on ports 5432-5439. Any port responding to a PostgreSQL handshake that wasn't found via sockets gets added (catches Docker containers, custom configs).

3. **Database Enumeration** — For each instance, connect as the current OS username to the `postgres` database. Query `pg_database` for non-template databases.

4. **Auth Detection** — The connection attempt reveals the auth method:
   - Success without password → `trust` (no password needed)
   - Error `28P01`/`28000` → `password_required`
   - Connection refused/timeout → `unreachable` (skip)

**Data structures:**

```rust
struct DiscoveredServer {
    host: String,           // "localhost"
    port: u16,              // e.g. 5432
    socket_path: Option<String>,
    username: String,       // OS username
    auth_status: AuthStatus,
}

enum AuthStatus {
    Trust,           // No password needed
    PasswordRequired,
    Unreachable,
}

struct DiscoveredDatabase {
    server: DiscoveredServer,
    database_name: String,
    already_imported: bool,
}
```

**Tauri commands:**
- `discover_local_databases` — runs full discovery, returns `Vec<DiscoveredDatabase>`
- `get_current_username` — returns OS username

### UI — Discovery Modal

Triggered by an "Auto-Detect" button on the HomePage top bar (alongside Import/Export).

**States:**

1. **Scanning** — Spinner with "Scanning for local PostgreSQL databases..."
2. **Results** — List of databases grouped by server:
   - Checkbox per database
   - Database name + `localhost:<port>`
   - Auth badge: green "No password" / amber "Password required"
   - "Already added" badge for duplicates (grayed out, unchecked)
3. **Password Entry** — For selected password-required servers, one password input per server
4. **Importing** — Progress indicator while creating projects

**Controls:** Select All / Deselect All, Import Selected, Cancel

### Data Flow

Imported databases become projects with:
- `name`: database name
- `host`: "localhost", `port`: detected port
- `username`: OS username, `password`: empty (trust) or user-entered
- `ssl`: false, `color`: auto-cycled, default settings

**Password handling:**
- Trust auth: no password saved, connection string omits password
- Password required: saved to system keychain via existing `save_password`

**Duplicate detection:** Match on `host + port + database`. Already-existing projects shown as "Already added."

### Changes to Existing Code

- `ConnectionConfig.connection_string()` — handle `password: None` (omit from URL instead of including empty string)
- `HomePage.tsx` — add "Auto-Detect" button
- `uiStore.ts` — add `discoveryModalOpen: boolean`

### Error Handling

| Scenario | Behavior |
|----------|----------|
| No PostgreSQL found | Empty state: "No local databases detected. Make sure PostgreSQL is running." |
| Stale socket file | 3-second timeout, skip silently |
| macOS firewall prompt (TCP) | OS-level dialog, no in-app handling needed |
| Wrong password entered | Inline error on password field, modal stays open |
| Server down during import | Error toast: "Could not connect to localhost:5432" |
| Mixed auth on same server | Detect per-database during enumeration |
