use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Commit {
    pub id: String,
    pub parent_id: Option<String>,
    pub message: String,
    pub summary: String,
    pub created_at: String,
    pub change_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitChange {
    pub id: i64,
    pub commit_id: String,
    #[serde(rename = "type")]
    pub change_type: String,
    pub schema_name: String,
    pub table_name: String,
    pub data: String,
    pub original_data: Option<String>,
    pub sql: String,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitDetail {
    pub commit: Commit,
    pub changes: Vec<CommitChange>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveCommitRequest {
    pub project_id: String,
    pub message: String,
    pub summary: String,
    pub changes: Vec<SaveCommitChange>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveCommitChange {
    #[serde(rename = "type")]
    pub change_type: String,
    pub schema_name: String,
    pub table_name: String,
    pub data: String,
    pub original_data: Option<String>,
    pub sql: String,
}

pub struct CommitStore;

impl CommitStore {
    fn db_path(project_id: &str) -> Result<PathBuf, String> {
        let data_dir = dirs::data_dir()
            .ok_or_else(|| "Could not find app data directory".to_string())?;
        let commits_dir = data_dir.join("com.tusker.app").join("commits");
        std::fs::create_dir_all(&commits_dir)
            .map_err(|e| format!("Failed to create commits directory: {}", e))?;
        Ok(commits_dir.join(format!("{}.db", project_id)))
    }

    fn open(project_id: &str) -> Result<Connection, String> {
        let path = Self::db_path(project_id)?;
        let conn = Connection::open(&path)
            .map_err(|e| format!("Failed to open commit database: {}", e))?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS commits (
                id TEXT PRIMARY KEY,
                parent_id TEXT,
                message TEXT NOT NULL,
                summary TEXT NOT NULL,
                created_at TEXT NOT NULL,
                change_count INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS commit_changes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                commit_id TEXT NOT NULL REFERENCES commits(id),
                type TEXT NOT NULL,
                schema_name TEXT NOT NULL,
                table_name TEXT NOT NULL,
                data TEXT NOT NULL,
                original_data TEXT,
                sql TEXT NOT NULL,
                sort_order INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_commit_changes_commit_id ON commit_changes(commit_id);"
        ).map_err(|e| format!("Failed to initialize commit tables: {}", e))?;

        Ok(conn)
    }

    fn generate_hash(parent_id: &Option<String>, timestamp: &str, sql_statements: &[String]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(parent_id.as_deref().unwrap_or("root"));
        hasher.update(timestamp);
        for sql in sql_statements {
            hasher.update(sql);
        }
        let result = hasher.finalize();
        hex::encode(&result[..])
    }

    fn get_latest_commit_id(conn: &Connection) -> Result<Option<String>, String> {
        let mut stmt = conn.prepare(
            "SELECT id FROM commits ORDER BY created_at DESC LIMIT 1"
        ).map_err(|e| format!("Failed to query latest commit: {}", e))?;

        let result = stmt.query_row([], |row| row.get::<_, String>(0)).ok();
        Ok(result)
    }

    pub fn save_commit(request: SaveCommitRequest) -> Result<Commit, String> {
        let conn = Self::open(&request.project_id)?;
        let parent_id = Self::get_latest_commit_id(&conn)?;

        let now = chrono::Utc::now().to_rfc3339();
        let sql_statements: Vec<String> = request.changes.iter().map(|c| c.sql.clone()).collect();
        let hash = Self::generate_hash(&parent_id, &now, &sql_statements);

        let commit = Commit {
            id: hash.clone(),
            parent_id: parent_id.clone(),
            message: request.message.clone(),
            summary: request.summary.clone(),
            created_at: now.clone(),
            change_count: request.changes.len() as i64,
        };

        conn.execute(
            "INSERT INTO commits (id, parent_id, message, summary, created_at, change_count)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![commit.id, commit.parent_id, commit.message, commit.summary, commit.created_at, commit.change_count],
        ).map_err(|e| format!("Failed to insert commit: {}", e))?;

        for (i, change) in request.changes.iter().enumerate() {
            conn.execute(
                "INSERT INTO commit_changes (commit_id, type, schema_name, table_name, data, original_data, sql, sort_order)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    hash,
                    change.change_type,
                    change.schema_name,
                    change.table_name,
                    change.data,
                    change.original_data,
                    change.sql,
                    i as i64
                ],
            ).map_err(|e| format!("Failed to insert commit change: {}", e))?;
        }

        Ok(commit)
    }

    pub fn get_commits(project_id: &str) -> Result<Vec<Commit>, String> {
        let conn = Self::open(project_id)?;

        let mut stmt = conn.prepare(
            "SELECT id, parent_id, message, summary, created_at, change_count
             FROM commits ORDER BY created_at DESC"
        ).map_err(|e| format!("Failed to query commits: {}", e))?;

        let commits = stmt.query_map([], |row| {
            Ok(Commit {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                message: row.get(2)?,
                summary: row.get(3)?,
                created_at: row.get(4)?,
                change_count: row.get(5)?,
            })
        }).map_err(|e| format!("Failed to read commits: {}", e))?
          .collect::<Result<Vec<_>, _>>()
          .map_err(|e| format!("Failed to collect commits: {}", e))?;

        Ok(commits)
    }

    pub fn get_commit_detail(project_id: &str, commit_id: &str) -> Result<CommitDetail, String> {
        let conn = Self::open(project_id)?;

        let commit = conn.query_row(
            "SELECT id, parent_id, message, summary, created_at, change_count
             FROM commits WHERE id = ?1",
            params![commit_id],
            |row| {
                Ok(Commit {
                    id: row.get(0)?,
                    parent_id: row.get(1)?,
                    message: row.get(2)?,
                    summary: row.get(3)?,
                    created_at: row.get(4)?,
                    change_count: row.get(5)?,
                })
            },
        ).map_err(|e| format!("Commit not found: {}", e))?;

        let mut stmt = conn.prepare(
            "SELECT id, commit_id, type, schema_name, table_name, data, original_data, sql, sort_order
             FROM commit_changes WHERE commit_id = ?1 ORDER BY sort_order"
        ).map_err(|e| format!("Failed to query commit changes: {}", e))?;

        let changes = stmt.query_map(params![commit_id], |row| {
            Ok(CommitChange {
                id: row.get(0)?,
                commit_id: row.get(1)?,
                change_type: row.get(2)?,
                schema_name: row.get(3)?,
                table_name: row.get(4)?,
                data: row.get(5)?,
                original_data: row.get(6)?,
                sql: row.get(7)?,
                sort_order: row.get(8)?,
            })
        }).map_err(|e| format!("Failed to read commit changes: {}", e))?
          .collect::<Result<Vec<_>, _>>()
          .map_err(|e| format!("Failed to collect commit changes: {}", e))?;

        Ok(CommitDetail { commit, changes })
    }
}
