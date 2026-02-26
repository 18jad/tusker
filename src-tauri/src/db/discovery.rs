use serde::{Deserialize, Serialize};
use sqlx::postgres::PgPoolOptions;
use sqlx::Row;
use std::collections::HashSet;
use std::time::Duration;
use tokio::net::TcpStream;
use tokio::time::timeout;

/// Authentication status for a discovered PostgreSQL server.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthStatus {
    Trust,
    PasswordRequired,
}

/// A discovered PostgreSQL server (host + port + auth status).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredServer {
    pub host: String,
    pub port: u16,
    pub auth_status: AuthStatus,
    pub username: String,
}

/// A discovered database on a PostgreSQL server.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredDatabase {
    pub host: String,
    pub port: u16,
    pub database_name: String,
    pub username: String,
    pub auth_status: AuthStatus,
    pub already_imported: bool,
}

/// Scans well-known Unix socket directories for PostgreSQL socket files.
/// Returns a set of ports that have active socket files.
pub fn scan_socket_dirs() -> HashSet<u16> {
    let mut ports = HashSet::new();
    let socket_dirs = ["/tmp", "/var/run/postgresql"];

    for dir in &socket_dirs {
        let path = std::path::Path::new(dir);
        if !path.is_dir() {
            continue;
        }

        let entries = match std::fs::read_dir(path) {
            Ok(entries) => entries,
            Err(e) => {
                log::debug!("Could not read socket directory {}: {}", dir, e);
                continue;
            }
        };

        for entry in entries.flatten() {
            let file_name = entry.file_name();
            let name = file_name.to_string_lossy();
            if let Some(port_str) = name.strip_prefix(".s.PGSQL.") {
                if let Ok(port) = port_str.parse::<u16>() {
                    log::debug!("Found PostgreSQL socket for port {} in {}", port, dir);
                    ports.insert(port);
                }
            }
        }
    }

    ports
}

/// Probes localhost TCP ports 5432-5439 for PostgreSQL servers,
/// skipping ports already discovered via sockets.
pub async fn probe_tcp_ports(known_ports: &HashSet<u16>) -> HashSet<u16> {
    let mut extra_ports = HashSet::new();

    for port in 5432..=5439 {
        if known_ports.contains(&port) {
            continue;
        }

        let addr = format!("127.0.0.1:{}", port);
        match timeout(Duration::from_secs(1), TcpStream::connect(&addr)).await {
            Ok(Ok(_)) => {
                log::debug!("TCP probe: port {} is open", port);
                extra_ports.insert(port);
            }
            Ok(Err(_)) | Err(_) => {
                // Connection refused or timeout — no server on this port
            }
        }
    }

    extra_ports
}

/// Probes a single PostgreSQL server to determine auth status and enumerate databases.
///
/// Returns `(AuthStatus, Vec<String>)` where the database list contains:
/// - Actual database names if trust auth succeeds
/// - `["__unreachable__"]` if the server cannot be reached at all
/// - `["postgres"]` as a placeholder if password auth is required
pub async fn probe_server(host: &str, port: u16, username: &str) -> (AuthStatus, Vec<String>) {
    let encoded_user = urlencoding::encode(username);
    let conn_str = format!(
        "postgres://{}@{}:{}/postgres?sslmode=disable",
        encoded_user, host, port
    );

    let pool = match PgPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(Duration::from_secs(3))
        .connect(&conn_str)
        .await
    {
        Ok(pool) => pool,
        Err(e) => {
            let err_str = e.to_string();
            // Check for password-required error codes: 28P01 (invalid password) or 28000 (invalid authorization)
            if err_str.contains("28P01") || err_str.contains("28000") {
                log::debug!(
                    "Server {}:{} requires password for user {}",
                    host,
                    port,
                    username
                );
                return (AuthStatus::PasswordRequired, vec!["postgres".to_string()]);
            }
            log::debug!("Could not connect to {}:{}: {}", host, port, err_str);
            return (
                AuthStatus::PasswordRequired,
                vec!["__unreachable__".to_string()],
            );
        }
    };

    // Trust auth succeeded — enumerate databases
    let databases = match sqlx::query("SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname")
        .fetch_all(&pool)
        .await
    {
        Ok(rows) => {
            let names: Vec<String> = rows.iter().map(|r| r.get("datname")).collect();
            log::debug!(
                "Server {}:{} trust auth, found {} databases",
                host,
                port,
                names.len()
            );
            names
        }
        Err(e) => {
            log::warn!(
                "Trust auth succeeded on {}:{} but failed to list databases: {}",
                host,
                port,
                e
            );
            vec!["postgres".to_string()]
        }
    };

    pool.close().await;

    (AuthStatus::Trust, databases)
}

/// Returns the current OS username, with fallbacks.
pub fn get_current_username() -> String {
    std::env::var("USER")
        .or_else(|_| std::env::var("USERNAME"))
        .unwrap_or_else(|_| "postgres".to_string())
}

/// Discovers local PostgreSQL databases by scanning Unix sockets, probing TCP ports,
/// and enumerating databases on each discovered server.
///
/// `existing_connections` is a list of `(host, port, database)` tuples for connections
/// that the user already has configured, so we can mark them as already imported.
pub async fn discover_local_databases(
    existing_connections: Vec<(String, u16, String)>,
) -> Vec<DiscoveredDatabase> {
    let username = get_current_username();

    // Step 1: Scan Unix sockets
    let socket_ports = scan_socket_dirs();
    log::info!("Socket scan found {} ports", socket_ports.len());

    // Step 2: Probe TCP ports
    let tcp_ports = probe_tcp_ports(&socket_ports).await;
    log::info!("TCP probe found {} additional ports", tcp_ports.len());

    // Merge all discovered ports
    let all_ports: HashSet<u16> = socket_ports.union(&tcp_ports).copied().collect();

    // Step 3: Probe each server
    let mut results: Vec<DiscoveredDatabase> = Vec::new();

    for port in &all_ports {
        let host = "localhost".to_string();

        let (auth_status, databases) = probe_server(&host, *port, &username).await;

        // Filter out the sentinel value for unreachable servers
        if databases.len() == 1 && databases[0] == "__unreachable__" {
            log::debug!("Server on port {} is unreachable, skipping", port);
            continue;
        }

        for db_name in &databases {
            let already = existing_connections.iter().any(|(h, p, d)| {
                (h == "localhost" || h == "127.0.0.1") && *p == *port && d == db_name
            });

            results.push(DiscoveredDatabase {
                host: host.clone(),
                port: *port,
                database_name: db_name.clone(),
                username: username.clone(),
                auth_status: auth_status.clone(),
                already_imported: already,
            });
        }
    }

    // Sort by port, then by database name
    results.sort_by(|a, b| a.port.cmp(&b.port).then_with(|| a.database_name.cmp(&b.database_name)));

    log::info!("Discovery complete: found {} databases", results.len());
    results
}
