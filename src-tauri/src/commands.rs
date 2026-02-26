use crate::db::{
    BulkInsertRequest, ColumnInfo, Commit, CommitDetail, CommitStore, ConnectionConfig,
    ConnectionInfo, ConnectionManager, ConstraintInfo, CredentialStorage, DataOperations,
    DeleteRequest, DiscoveredDatabase, FilterCondition, IndexInfo, InsertRequest,
    MigrationOperations, MigrationRequest, MigrationResult, PaginatedResult, QueryResult,
    SaveCommitChange, SaveCommitRequest, SchemaInfo, SchemaIntrospector, SchemaWithTables,
    SslMode, TableColumnsInfo, TableInfo, UpdateRequest,
};
use crate::db::export::{self, ExportedProject};
use crate::error::Result;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::Row;
use std::sync::Arc;
use std::time::Duration;
use tauri::State;
use tokio::sync::RwLock;

/// Application state containing the connection manager
pub struct AppState {
    pub connection_manager: Arc<RwLock<ConnectionManager>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            connection_manager: Arc::new(RwLock::new(ConnectionManager::new())),
        }
    }
}

// ============================================================================
// Connection Commands
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectRequest {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
    pub ssl_mode: Option<SslMode>,
    pub save_connection: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectResponse {
    pub connection_id: String,
    pub message: String,
}

#[tauri::command]
pub async fn connect(
    state: State<'_, AppState>,
    request: ConnectRequest,
) -> Result<ConnectResponse> {
    let mut config = ConnectionConfig::new(
        request.name,
        request.host,
        request.port,
        request.database,
        request.username,
        Some(request.password.clone()),
    );

    if let Some(ssl_mode) = request.ssl_mode {
        config.ssl_mode = ssl_mode;
    }

    let connection_manager = state.connection_manager.read().await;
    let connection_id = connection_manager.connect(config.clone(), &request.password).await?;

    // Save connection config and password if requested
    if request.save_connection.unwrap_or(false) {
        CredentialStorage::save_connection_config(&config)?;
        CredentialStorage::save_password(&config.id, &request.password)?;
    }

    Ok(ConnectResponse {
        connection_id,
        message: "Connected successfully".to_string(),
    })
}

#[tauri::command]
pub async fn connect_saved(
    state: State<'_, AppState>,
    connection_id: String,
) -> Result<ConnectResponse> {
    let config = CredentialStorage::get_connection_config(&connection_id)?;
    let password = CredentialStorage::get_password(&connection_id)?;

    let connection_manager = state.connection_manager.read().await;
    let id = connection_manager.connect(config, &password).await?;

    Ok(ConnectResponse {
        connection_id: id,
        message: "Connected successfully".to_string(),
    })
}

#[tauri::command]
pub async fn disconnect(state: State<'_, AppState>, connection_id: String) -> Result<()> {
    let connection_manager = state.connection_manager.read().await;
    connection_manager.disconnect(&connection_id).await
}

#[tauri::command]
pub async fn disconnect_all(state: State<'_, AppState>) -> Result<()> {
    let connection_manager = state.connection_manager.read().await;
    connection_manager.disconnect_all().await
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestConnectionRequest {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
    pub ssl_mode: Option<SslMode>,
}

#[tauri::command]
pub async fn test_connection(request: TestConnectionRequest) -> Result<String> {
    let mut config = ConnectionConfig::new(
        "test".to_string(),
        request.host,
        request.port,
        request.database,
        request.username,
        None,
    );

    if let Some(ssl_mode) = request.ssl_mode {
        config.ssl_mode = ssl_mode;
    }

    ConnectionManager::test_connection(&config, &request.password).await?;

    Ok("Connection successful".to_string())
}

#[tauri::command]
pub async fn list_active_connections(state: State<'_, AppState>) -> Result<Vec<ConnectionInfo>> {
    let connection_manager = state.connection_manager.read().await;
    Ok(connection_manager.list_active_connections().await)
}

#[tauri::command]
pub async fn is_connected(state: State<'_, AppState>, connection_id: String) -> Result<bool> {
    let connection_manager = state.connection_manager.read().await;
    Ok(connection_manager.is_connected(&connection_id).await)
}

#[tauri::command]
pub async fn ping_database(
    state: State<'_, AppState>,
    connection_id: String,
) -> Result<bool> {
    let connection_manager = state.connection_manager.read().await;
    let pool = match connection_manager.get_pool(&connection_id).await {
        Ok(pool) => pool,
        Err(_) => return Ok(false),
    };

    match tokio::time::timeout(
        Duration::from_secs(5),
        sqlx::query("SELECT 1").fetch_one(&pool),
    )
    .await
    {
        Ok(Ok(row)) => Ok(row.get::<i32, _>(0) == 1),
        _ => Ok(false),
    }
}

// ============================================================================
// Saved Connections Commands
// ============================================================================

#[tauri::command]
pub fn get_saved_connections() -> Result<Vec<ConnectionConfig>> {
    CredentialStorage::get_all_connection_configs()
}

#[tauri::command]
pub fn save_connection(config: ConnectionConfig, password: String) -> Result<()> {
    CredentialStorage::save_connection_config(&config)?;
    CredentialStorage::save_password(&config.id, &password)?;
    Ok(())
}

#[tauri::command]
pub fn delete_saved_connection(connection_id: String) -> Result<()> {
    CredentialStorage::delete_connection_config(&connection_id)
}

#[tauri::command]
pub fn get_saved_password(connection_id: String) -> Result<String> {
    CredentialStorage::get_password(&connection_id)
}

#[tauri::command]
pub fn save_password(project_id: String, password: String) -> Result<()> {
    CredentialStorage::save_password(&project_id, &password)
}

#[tauri::command]
pub fn delete_password(project_id: String) -> Result<()> {
    CredentialStorage::delete_password(&project_id)
}

// ============================================================================
// Schema Commands
// ============================================================================

#[tauri::command]
pub async fn get_schemas(state: State<'_, AppState>, connection_id: String) -> Result<Vec<SchemaInfo>> {
    let connection_manager = state.connection_manager.read().await;
    let pool = connection_manager.get_pool(&connection_id).await?;
    SchemaIntrospector::get_schemas(&pool).await
}

#[tauri::command]
pub async fn get_schemas_with_tables(
    state: State<'_, AppState>,
    connection_id: String,
) -> Result<Vec<SchemaWithTables>> {
    let connection_manager = state.connection_manager.read().await;
    let pool = connection_manager.get_pool(&connection_id).await?;
    SchemaIntrospector::get_schemas_with_tables(&pool).await
}

#[tauri::command]
pub async fn get_tables(
    state: State<'_, AppState>,
    connection_id: String,
    schema: String,
) -> Result<Vec<TableInfo>> {
    let connection_manager = state.connection_manager.read().await;
    let pool = connection_manager.get_pool(&connection_id).await?;
    SchemaIntrospector::get_tables(&pool, &schema).await
}

#[tauri::command]
pub async fn get_columns(
    state: State<'_, AppState>,
    connection_id: String,
    schema: String,
    table: String,
) -> Result<Vec<ColumnInfo>> {
    let connection_manager = state.connection_manager.read().await;
    let pool = connection_manager.get_pool(&connection_id).await?;
    SchemaIntrospector::get_columns(&pool, &schema, &table).await
}

#[tauri::command]
pub async fn get_all_columns(
    state: State<'_, AppState>,
    connection_id: String,
    schemas: Vec<String>,
) -> Result<Vec<TableColumnsInfo>> {
    let connection_manager = state.connection_manager.read().await;
    let pool = connection_manager.get_pool(&connection_id).await?;
    SchemaIntrospector::get_all_columns(&pool, &schemas).await
}

#[tauri::command]
pub async fn get_row_count(
    state: State<'_, AppState>,
    connection_id: String,
    schema: String,
    table: String,
) -> Result<i64> {
    let connection_manager = state.connection_manager.read().await;
    let pool = connection_manager.get_pool(&connection_id).await?;
    SchemaIntrospector::get_row_count(&pool, &schema, &table).await
}

#[tauri::command]
pub async fn get_indexes(
    state: State<'_, AppState>,
    connection_id: String,
    schema: String,
    table: String,
) -> Result<Vec<IndexInfo>> {
    let connection_manager = state.connection_manager.read().await;
    let pool = connection_manager.get_pool(&connection_id).await?;
    SchemaIntrospector::get_indexes(&pool, &schema, &table).await
}

#[tauri::command]
pub async fn get_constraints(
    state: State<'_, AppState>,
    connection_id: String,
    schema: String,
    table: String,
) -> Result<Vec<ConstraintInfo>> {
    let connection_manager = state.connection_manager.read().await;
    let pool = connection_manager.get_pool(&connection_id).await?;
    SchemaIntrospector::get_constraints(&pool, &schema, &table).await
}

// ============================================================================
// Data Commands
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FetchDataRequest {
    pub connection_id: String,
    pub schema: String,
    pub table: String,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub order_by: Option<Vec<String>>,
    pub order_direction: Option<Vec<String>>,
    pub filters: Option<Vec<FilterCondition>>,
}

#[tauri::command]
pub async fn fetch_table_data(
    state: State<'_, AppState>,
    request: FetchDataRequest,
) -> Result<PaginatedResult> {
    let connection_manager = state.connection_manager.read().await;
    let pool = connection_manager.get_pool(&request.connection_id).await?;

    DataOperations::fetch_paginated(
        &pool,
        &request.schema,
        &request.table,
        request.page.unwrap_or(1),
        request.page_size,
        request.order_by.as_ref(),
        request.order_direction.as_ref(),
        request.filters.as_ref(),
    )
    .await
}

#[tauri::command]
pub async fn insert_row(
    state: State<'_, AppState>,
    connection_id: String,
    schema: String,
    table: String,
    data: serde_json::Map<String, JsonValue>,
) -> Result<JsonValue> {
    let connection_manager = state.connection_manager.read().await;
    let pool = connection_manager.get_pool(&connection_id).await?;

    let request = InsertRequest {
        schema,
        table,
        data,
    };

    DataOperations::insert_row(&pool, request).await
}

#[tauri::command]
pub async fn bulk_insert(
    state: State<'_, AppState>,
    connection_id: String,
    schema: String,
    table: String,
    rows: Vec<serde_json::Map<String, JsonValue>>,
) -> Result<u64> {
    let connection_manager = state.connection_manager.read().await;
    let pool = connection_manager.get_pool(&connection_id).await?;

    let request = BulkInsertRequest {
        schema,
        table,
        rows,
    };

    DataOperations::bulk_insert(&pool, request).await
}

#[tauri::command]
pub async fn update_row(
    state: State<'_, AppState>,
    connection_id: String,
    schema: String,
    table: String,
    data: serde_json::Map<String, JsonValue>,
    where_clause: serde_json::Map<String, JsonValue>,
) -> Result<u64> {
    let connection_manager = state.connection_manager.read().await;
    let pool = connection_manager.get_pool(&connection_id).await?;

    let request = UpdateRequest {
        schema,
        table,
        data,
        where_clause,
    };

    DataOperations::update_row(&pool, request).await
}

#[tauri::command]
pub async fn delete_row(
    state: State<'_, AppState>,
    connection_id: String,
    schema: String,
    table: String,
    where_clause: serde_json::Map<String, JsonValue>,
) -> Result<u64> {
    let connection_manager = state.connection_manager.read().await;
    let pool = connection_manager.get_pool(&connection_id).await?;

    let request = DeleteRequest {
        schema,
        table,
        where_clause,
    };

    DataOperations::delete_row(&pool, request).await
}

#[tauri::command]
pub async fn execute_query(
    state: State<'_, AppState>,
    connection_id: String,
    sql: String,
) -> Result<QueryResult> {
    let connection_manager = state.connection_manager.read().await;
    let pool = connection_manager.get_pool(&connection_id).await?;

    DataOperations::execute_raw_query(&pool, &sql).await
}

#[tauri::command]
pub async fn execute_migration(
    state: State<'_, AppState>,
    request: MigrationRequest,
) -> Result<MigrationResult> {
    let connection_manager = state.connection_manager.read().await;
    let pool = connection_manager.get_pool(&request.connection_id).await?;

    MigrationOperations::execute_migration(
        &pool,
        &request.statements,
        request.dry_run,
        request.lock_timeout_ms,
        request.statement_timeout_ms,
    )
    .await
}

// ============================================================================
// Utility Commands
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseInfo {
    pub version: String,
    pub current_database: String,
    pub current_user: String,
    pub server_encoding: String,
    pub client_encoding: String,
}

#[tauri::command]
pub async fn get_database_info(
    state: State<'_, AppState>,
    connection_id: String,
) -> Result<DatabaseInfo> {
    let connection_manager = state.connection_manager.read().await;
    let pool = connection_manager.get_pool(&connection_id).await?;

    let version: (String,) = sqlx::query_as("SELECT version()").fetch_one(&pool).await?;

    let current_db: (String,) = sqlx::query_as("SELECT current_database()")
        .fetch_one(&pool)
        .await?;

    let current_user: (String,) = sqlx::query_as("SELECT current_user")
        .fetch_one(&pool)
        .await?;

    let server_encoding: (String,) = sqlx::query_as("SHOW server_encoding")
        .fetch_one(&pool)
        .await?;

    let client_encoding: (String,) = sqlx::query_as("SHOW client_encoding")
        .fetch_one(&pool)
        .await?;

    Ok(DatabaseInfo {
        version: version.0,
        current_database: current_db.0,
        current_user: current_user.0,
        server_encoding: server_encoding.0,
        client_encoding: client_encoding.0,
    })
}

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

// ============================================================================
// Export/Import Commands
// ============================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct ProjectForExport {
    pub id: String,
    pub name: String,
    pub color: String,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub ssl: bool,
    pub instant_commit: bool,
    pub read_only: bool,
    pub last_connected: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ImportedProject {
    pub id: String,
    pub name: String,
    pub color: String,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub ssl: bool,
    pub instant_commit: bool,
    pub read_only: bool,
    pub last_connected: Option<String>,
    pub created_at: String,
}

#[tauri::command]
pub fn export_connections(
    projects: Vec<ProjectForExport>,
    password: String,
    file_path: String,
) -> Result<()> {
    let exported: Vec<ExportedProject> = projects
        .into_iter()
        .map(|p| {
            let db_password = CredentialStorage::get_password(&p.id).unwrap_or_default();
            ExportedProject {
                name: p.name,
                color: p.color,
                host: p.host,
                port: p.port,
                database: p.database,
                username: p.username,
                password: db_password,
                ssl: p.ssl,
                instant_commit: p.instant_commit,
                read_only: p.read_only,
                last_connected: p.last_connected,
                created_at: p.created_at,
            }
        })
        .collect();

    export::encrypt_and_write(exported, &password, &file_path)
}

#[tauri::command]
pub fn import_connections(
    password: String,
    file_path: String,
) -> Result<Vec<ImportedProject>> {
    let payload = export::read_and_decrypt(&file_path, &password)?;

    let mut imported = Vec::new();

    for project in payload.projects {
        let new_id = uuid::Uuid::new_v4().to_string();

        // Save password to keychain
        if !project.password.is_empty() {
            CredentialStorage::save_password(&new_id, &project.password)?;
        }

        imported.push(ImportedProject {
            id: new_id,
            name: project.name,
            color: project.color,
            host: project.host,
            port: project.port,
            database: project.database,
            username: project.username,
            ssl: project.ssl,
            instant_commit: project.instant_commit,
            read_only: project.read_only,
            last_connected: project.last_connected,
            created_at: project.created_at,
        });
    }

    Ok(imported)
}

// ============================================================================
// Discovery Commands
// ============================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct ExistingConnection {
    pub host: String,
    pub port: u16,
    pub database: String,
}

#[tauri::command]
pub async fn discover_local_databases(
    existing: Vec<ExistingConnection>,
) -> Result<Vec<DiscoveredDatabase>> {
    let existing_tuples: Vec<(String, u16, String)> = existing
        .into_iter()
        .map(|e| (e.host, e.port, e.database))
        .collect();

    Ok(crate::db::discovery::discover_local_databases(existing_tuples).await)
}

#[tauri::command]
pub fn get_current_username() -> String {
    crate::db::discovery::get_current_username()
}
