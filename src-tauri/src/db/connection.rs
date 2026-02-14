use crate::error::{DbViewerError, Result};
use keyring::Entry;
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

const KEYRING_SERVICE: &str = "db-viewer-app";
const KEYRING_CONNECTIONS_KEY: &str = "connections";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    #[serde(skip_serializing)]
    pub password: Option<String>,
    pub ssl_mode: SslMode,
    pub max_connections: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum SslMode {
    Disable,
    #[default]
    Prefer,
    Require,
}

impl std::fmt::Display for SslMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SslMode::Disable => write!(f, "disable"),
            SslMode::Prefer => write!(f, "prefer"),
            SslMode::Require => write!(f, "require"),
        }
    }
}

impl ConnectionConfig {
    pub fn new(
        name: String,
        host: String,
        port: u16,
        database: String,
        username: String,
        password: Option<String>,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            host,
            port,
            database,
            username,
            password,
            ssl_mode: SslMode::default(),
            max_connections: 10,
        }
    }

    pub fn connection_string(&self, password: &str) -> String {
        format!(
            "postgres://{}:{}@{}:{}/{}?sslmode={}",
            urlencoding::encode(&self.username),
            urlencoding::encode(password),
            self.host,
            self.port,
            urlencoding::encode(&self.database),
            self.ssl_mode
        )
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedConnection {
    pub config: ConnectionConfig,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub last_used_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug)]
pub struct ActiveConnection {
    pub config: ConnectionConfig,
    pub pool: PgPool,
    pub connected_at: chrono::DateTime<chrono::Utc>,
}

pub struct ConnectionManager {
    active_connections: Arc<RwLock<HashMap<String, ActiveConnection>>>,
}

impl Default for ConnectionManager {
    fn default() -> Self {
        Self::new()
    }
}

impl ConnectionManager {
    pub fn new() -> Self {
        Self {
            active_connections: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn connect(&self, config: ConnectionConfig, password: &str) -> Result<String> {
        let connection_string = config.connection_string(password);
        let connection_id = config.id.clone();

        // Check if already connected
        {
            let connections = self.active_connections.read().await;
            if connections.contains_key(&connection_id) {
                return Err(DbViewerError::ConnectionAlreadyExists(connection_id));
            }
        }

        // Create connection pool
        let pool = PgPoolOptions::new()
            .max_connections(config.max_connections)
            .acquire_timeout(std::time::Duration::from_secs(10))
            .connect(&connection_string)
            .await?;

        // Test the connection
        sqlx::query("SELECT 1").execute(&pool).await?;

        let active_connection = ActiveConnection {
            config,
            pool,
            connected_at: chrono::Utc::now(),
        };

        {
            let mut connections = self.active_connections.write().await;
            connections.insert(connection_id.clone(), active_connection);
        }

        Ok(connection_id)
    }

    pub async fn disconnect(&self, connection_id: &str) -> Result<()> {
        let mut connections = self.active_connections.write().await;

        if let Some(connection) = connections.remove(connection_id) {
            connection.pool.close().await;
            Ok(())
        } else {
            Err(DbViewerError::ConnectionNotFound(connection_id.to_string()))
        }
    }

    pub async fn disconnect_all(&self) -> Result<()> {
        let mut connections = self.active_connections.write().await;

        for (_, connection) in connections.drain() {
            connection.pool.close().await;
        }

        Ok(())
    }

    pub async fn get_pool(&self, connection_id: &str) -> Result<PgPool> {
        let connections = self.active_connections.read().await;

        connections
            .get(connection_id)
            .map(|c| c.pool.clone())
            .ok_or_else(|| DbViewerError::ConnectionNotFound(connection_id.to_string()))
    }

    pub async fn test_connection(config: &ConnectionConfig, password: &str) -> Result<()> {
        let connection_string = config.connection_string(password);

        let pool = PgPoolOptions::new()
            .max_connections(1)
            .acquire_timeout(std::time::Duration::from_secs(10))
            .connect(&connection_string)
            .await?;

        sqlx::query("SELECT 1").execute(&pool).await?;
        pool.close().await;

        Ok(())
    }

    pub async fn list_active_connections(&self) -> Vec<ConnectionInfo> {
        let connections = self.active_connections.read().await;

        connections
            .values()
            .map(|c| ConnectionInfo {
                id: c.config.id.clone(),
                name: c.config.name.clone(),
                host: c.config.host.clone(),
                port: c.config.port,
                database: c.config.database.clone(),
                username: c.config.username.clone(),
                connected_at: c.connected_at,
            })
            .collect()
    }

    pub async fn is_connected(&self, connection_id: &str) -> bool {
        let connections = self.active_connections.read().await;
        connections.contains_key(connection_id)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionInfo {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub connected_at: chrono::DateTime<chrono::Utc>,
}

/// Secure credential storage using the system keyring
pub struct CredentialStorage;

impl CredentialStorage {
    fn get_entry(connection_id: &str) -> Result<Entry> {
        Entry::new(KEYRING_SERVICE, connection_id).map_err(|e| DbViewerError::Keyring(e.to_string()))
    }

    fn get_connections_entry() -> Result<Entry> {
        Entry::new(KEYRING_SERVICE, KEYRING_CONNECTIONS_KEY)
            .map_err(|e| DbViewerError::Keyring(e.to_string()))
    }

    pub fn save_password(connection_id: &str, password: &str) -> Result<()> {
        let entry = Self::get_entry(connection_id)?;
        entry.set_password(password)?;
        Ok(())
    }

    pub fn get_password(connection_id: &str) -> Result<String> {
        let entry = Self::get_entry(connection_id)?;
        entry
            .get_password()
            .map_err(|e| DbViewerError::Keyring(e.to_string()))
    }

    pub fn delete_password(connection_id: &str) -> Result<()> {
        let entry = Self::get_entry(connection_id)?;
        // Ignore error if password doesn't exist
        let _ = entry.delete_credential();
        Ok(())
    }

    pub fn save_connection_config(config: &ConnectionConfig) -> Result<()> {
        let mut configs = Self::get_all_connection_configs().unwrap_or_default();

        // Remove existing config with same ID if present
        configs.retain(|c| c.id != config.id);
        configs.push(config.clone());

        let json = serde_json::to_string(&configs)?;
        let entry = Self::get_connections_entry()?;
        entry.set_password(&json)?;

        Ok(())
    }

    pub fn get_all_connection_configs() -> Result<Vec<ConnectionConfig>> {
        let entry = Self::get_connections_entry()?;

        match entry.get_password() {
            Ok(json) => {
                let configs: Vec<ConnectionConfig> = serde_json::from_str(&json)?;
                Ok(configs)
            }
            Err(keyring::Error::NoEntry) => Ok(Vec::new()),
            Err(e) => Err(DbViewerError::Keyring(e.to_string())),
        }
    }

    pub fn get_connection_config(connection_id: &str) -> Result<ConnectionConfig> {
        let configs = Self::get_all_connection_configs()?;
        configs
            .into_iter()
            .find(|c| c.id == connection_id)
            .ok_or_else(|| DbViewerError::ConnectionNotFound(connection_id.to_string()))
    }

    pub fn delete_connection_config(connection_id: &str) -> Result<()> {
        let mut configs = Self::get_all_connection_configs().unwrap_or_default();
        configs.retain(|c| c.id != connection_id);

        let json = serde_json::to_string(&configs)?;
        let entry = Self::get_connections_entry()?;
        entry.set_password(&json)?;

        // Also delete the password
        Self::delete_password(connection_id)?;

        Ok(())
    }
}
