use crate::error::{DbViewerError, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::postgres::PgRow;
use sqlx::{Column, Executor, PgPool, Row, TypeInfo};
use std::time::Instant;

const DEFAULT_PAGE_SIZE: i64 = 50;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResult {
    pub rows: Vec<serde_json::Map<String, JsonValue>>,
    pub total_count: i64,
    pub page: i64,
    pub page_size: i64,
    pub total_pages: i64,
    pub columns: Vec<ColumnMeta>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnMeta {
    pub name: String,
    pub data_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResult {
    pub rows: Vec<serde_json::Map<String, JsonValue>>,
    pub columns: Vec<ColumnMeta>,
    pub rows_affected: u64,
    pub execution_time_ms: u128,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InsertRequest {
    pub schema: String,
    pub table: String,
    pub data: serde_json::Map<String, JsonValue>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkInsertRequest {
    pub schema: String,
    pub table: String,
    pub rows: Vec<serde_json::Map<String, JsonValue>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateRequest {
    pub schema: String,
    pub table: String,
    pub data: serde_json::Map<String, JsonValue>,
    pub where_clause: serde_json::Map<String, JsonValue>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteRequest {
    pub schema: String,
    pub table: String,
    pub where_clause: serde_json::Map<String, JsonValue>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FilterOperator {
    Equals,
    NotEquals,
    GreaterThan,
    LessThan,
    GreaterThanOrEqual,
    LessThanOrEqual,
    Contains,
    NotContains,
    StartsWith,
    EndsWith,
    IsNull,
    IsNotNull,
    IsTrue,
    IsFalse,
    Between,
    In,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterCondition {
    pub column: String,
    pub operator: FilterOperator,
    pub value: Option<String>,
    pub value2: Option<String>,
    pub values: Option<Vec<String>>,
}

/// Escape LIKE wildcards in a string
fn escape_like_pattern(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

/// Build a WHERE clause from filter conditions
fn build_where_clause(filters: &[FilterCondition]) -> String {
    let conditions: Vec<String> = filters
        .iter()
        .filter_map(|f| {
            let col = quote_identifier(&f.column);
            match f.operator {
                FilterOperator::Equals => {
                    let v = f.value.as_ref()?;
                    Some(format!("{} = '{}'", col, escape_sql_string(v)))
                }
                FilterOperator::NotEquals => {
                    let v = f.value.as_ref()?;
                    Some(format!("{} != '{}'", col, escape_sql_string(v)))
                }
                FilterOperator::GreaterThan => {
                    let v = f.value.as_ref()?;
                    Some(format!("{} > '{}'", col, escape_sql_string(v)))
                }
                FilterOperator::LessThan => {
                    let v = f.value.as_ref()?;
                    Some(format!("{} < '{}'", col, escape_sql_string(v)))
                }
                FilterOperator::GreaterThanOrEqual => {
                    let v = f.value.as_ref()?;
                    Some(format!("{} >= '{}'", col, escape_sql_string(v)))
                }
                FilterOperator::LessThanOrEqual => {
                    let v = f.value.as_ref()?;
                    Some(format!("{} <= '{}'", col, escape_sql_string(v)))
                }
                FilterOperator::Contains => {
                    let v = f.value.as_ref()?;
                    Some(format!(
                        "{}::text ILIKE '{}' ESCAPE '\\'",
                        col,
                        escape_sql_string(&format!("%{}%", escape_like_pattern(v)))
                    ))
                }
                FilterOperator::NotContains => {
                    let v = f.value.as_ref()?;
                    Some(format!(
                        "{}::text NOT ILIKE '{}' ESCAPE '\\'",
                        col,
                        escape_sql_string(&format!("%{}%", escape_like_pattern(v)))
                    ))
                }
                FilterOperator::StartsWith => {
                    let v = f.value.as_ref()?;
                    Some(format!(
                        "{}::text ILIKE '{}' ESCAPE '\\'",
                        col,
                        escape_sql_string(&format!("{}%", escape_like_pattern(v)))
                    ))
                }
                FilterOperator::EndsWith => {
                    let v = f.value.as_ref()?;
                    Some(format!(
                        "{}::text ILIKE '{}' ESCAPE '\\'",
                        col,
                        escape_sql_string(&format!("%{}", escape_like_pattern(v)))
                    ))
                }
                FilterOperator::IsNull => Some(format!("{} IS NULL", col)),
                FilterOperator::IsNotNull => Some(format!("{} IS NOT NULL", col)),
                FilterOperator::IsTrue => Some(format!("{} = TRUE", col)),
                FilterOperator::IsFalse => Some(format!("{} = FALSE", col)),
                FilterOperator::Between => {
                    let v1 = f.value.as_ref()?;
                    let v2 = f.value2.as_ref()?;
                    Some(format!(
                        "{} BETWEEN '{}' AND '{}'",
                        col,
                        escape_sql_string(v1),
                        escape_sql_string(v2)
                    ))
                }
                FilterOperator::In => {
                    let vals = f.values.as_ref()?;
                    if vals.is_empty() {
                        return None;
                    }
                    let escaped: Vec<String> = vals
                        .iter()
                        .map(|v| format!("'{}'", escape_sql_string(v)))
                        .collect();
                    Some(format!("{} IN ({})", col, escaped.join(", ")))
                }
            }
        })
        .collect();

    if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    }
}

pub struct DataOperations;

impl DataOperations {
    /// Fetch paginated data from a table
    pub async fn fetch_paginated(
        pool: &PgPool,
        schema: &str,
        table: &str,
        page: i64,
        page_size: Option<i64>,
        order_by: Option<&Vec<String>>,
        order_direction: Option<&Vec<String>>,
        filters: Option<&Vec<FilterCondition>>,
    ) -> Result<PaginatedResult> {
        let page_size = page_size.unwrap_or(DEFAULT_PAGE_SIZE);
        let offset = (page - 1) * page_size;

        let order_clause = match order_by {
            Some(columns) if !columns.is_empty() => {
                let directions = order_direction.cloned().unwrap_or_default();
                let parts: Vec<String> = columns
                    .iter()
                    .enumerate()
                    .map(|(i, col)| {
                        let dir = directions
                            .get(i)
                            .map(|d| {
                                if d.to_uppercase() == "DESC" {
                                    "DESC"
                                } else {
                                    "ASC"
                                }
                            })
                            .unwrap_or("ASC");
                        format!("{} {}", quote_identifier(col), dir)
                    })
                    .collect();
                format!("ORDER BY {}", parts.join(", "))
            }
            _ => String::new(),
        };

        let where_clause = filters
            .filter(|f| !f.is_empty())
            .map(|f| build_where_clause(f))
            .unwrap_or_default();

        // Get total count
        let count_query = format!(
            "SELECT COUNT(*) FROM {}.{} {}",
            quote_identifier(schema),
            quote_identifier(table),
            where_clause
        );
        let total_count: (i64,) = sqlx::query_as(&count_query).fetch_one(pool).await?;
        let total_count = total_count.0;

        // Fetch data
        let data_query = format!(
            "SELECT * FROM {}.{} {} {} LIMIT {} OFFSET {}",
            quote_identifier(schema),
            quote_identifier(table),
            where_clause,
            order_clause,
            page_size,
            offset
        );

        let rows = sqlx::query(&data_query).fetch_all(pool).await?;

        let (rows, columns) = rows_to_json(&rows);

        let total_pages = (total_count as f64 / page_size as f64).ceil() as i64;

        Ok(PaginatedResult {
            rows,
            total_count,
            page,
            page_size,
            total_pages,
            columns,
        })
    }

    /// Insert a row into a table
    pub async fn insert_row(pool: &PgPool, request: InsertRequest) -> Result<JsonValue> {
        if request.data.is_empty() {
            return Err(DbViewerError::InvalidQuery(
                "No data provided for insert".to_string(),
            ));
        }

        let columns: Vec<&str> = request.data.keys().map(|s| s.as_str()).collect();
        let values: Vec<String> = request
            .data
            .values()
            .map(json_value_to_sql)
            .collect();

        let query = format!(
            "INSERT INTO {}.{} ({}) VALUES ({}) RETURNING *",
            quote_identifier(&request.schema),
            quote_identifier(&request.table),
            columns
                .iter()
                .map(|c| quote_identifier(c))
                .collect::<Vec<_>>()
                .join(", "),
            values.join(", ")
        );

        let row = pool.fetch_one(query.as_str()).await?;
        let (rows, _) = rows_to_json(&[row]);

        Ok(JsonValue::Object(
            rows.into_iter().next().unwrap_or_default(),
        ))
    }

    /// Bulk insert multiple rows into a table
    pub async fn bulk_insert(pool: &PgPool, request: BulkInsertRequest) -> Result<u64> {
        if request.rows.is_empty() {
            return Ok(0);
        }

        // Get columns from the first row
        let first_row = &request.rows[0];
        if first_row.is_empty() {
            return Err(DbViewerError::InvalidQuery(
                "No data provided for insert".to_string(),
            ));
        }

        let columns: Vec<&str> = first_row.keys().map(|s| s.as_str()).collect();
        let column_list = columns
            .iter()
            .map(|c| quote_identifier(c))
            .collect::<Vec<_>>()
            .join(", ");

        // Build VALUES clause for all rows
        let values_list: Vec<String> = request
            .rows
            .iter()
            .map(|row| {
                let values: Vec<String> = columns
                    .iter()
                    .map(|col| {
                        row.get(*col)
                            .map(json_value_to_sql)
                            .unwrap_or_else(|| "NULL".to_string())
                    })
                    .collect();
                format!("({})", values.join(", "))
            })
            .collect();

        let query = format!(
            "INSERT INTO {}.{} ({}) VALUES {}",
            quote_identifier(&request.schema),
            quote_identifier(&request.table),
            column_list,
            values_list.join(", ")
        );

        let result = pool.execute(query.as_str()).await?;
        Ok(result.rows_affected())
    }

    /// Update a row in a table
    pub async fn update_row(pool: &PgPool, request: UpdateRequest) -> Result<u64> {
        if request.data.is_empty() {
            return Err(DbViewerError::InvalidQuery(
                "No data provided for update".to_string(),
            ));
        }

        if request.where_clause.is_empty() {
            return Err(DbViewerError::InvalidQuery(
                "No where clause provided for update".to_string(),
            ));
        }

        let set_clause: Vec<String> = request
            .data
            .iter()
            .map(|(col, val)| format!("{} = {}", quote_identifier(col), json_value_to_sql(val)))
            .collect();

        let where_clause: Vec<String> = request
            .where_clause
            .iter()
            .map(|(col, val)| format!("{} = {}", quote_identifier(col), json_value_to_sql(val)))
            .collect();

        let query = format!(
            "UPDATE {}.{} SET {} WHERE {}",
            quote_identifier(&request.schema),
            quote_identifier(&request.table),
            set_clause.join(", "),
            where_clause.join(" AND ")
        );

        let result = pool.execute(query.as_str()).await?;

        Ok(result.rows_affected())
    }

    /// Delete a row from a table
    pub async fn delete_row(pool: &PgPool, request: DeleteRequest) -> Result<u64> {
        if request.where_clause.is_empty() {
            return Err(DbViewerError::InvalidQuery(
                "No where clause provided for delete".to_string(),
            ));
        }

        let where_clause: Vec<String> = request
            .where_clause
            .iter()
            .map(|(col, val)| format!("{} = {}", quote_identifier(col), json_value_to_sql(val)))
            .collect();

        let query = format!(
            "DELETE FROM {}.{} WHERE {}",
            quote_identifier(&request.schema),
            quote_identifier(&request.table),
            where_clause.join(" AND ")
        );

        let result = pool.execute(query.as_str()).await?;

        Ok(result.rows_affected())
    }

    /// Execute a raw SQL query
    pub async fn execute_raw_query(pool: &PgPool, sql: &str) -> Result<QueryResult> {
        let sql_trimmed = sql.trim();

        if sql_trimmed.is_empty() {
            return Err(DbViewerError::InvalidQuery("Empty query".to_string()));
        }

        let start_time = std::time::Instant::now();

        // Determine if this is a SELECT query or a mutation
        let sql_upper = sql_trimmed.to_uppercase();
        let is_select = sql_upper.starts_with("SELECT")
            || sql_upper.starts_with("WITH")
            || sql_upper.starts_with("EXPLAIN")
            || sql_upper.starts_with("SHOW");

        if is_select {
            let rows = sqlx::query(sql_trimmed).fetch_all(pool).await?;
            let (rows, columns) = rows_to_json(&rows);

            Ok(QueryResult {
                rows,
                columns,
                rows_affected: 0,
                execution_time_ms: start_time.elapsed().as_millis(),
            })
        } else {
            let result = pool.execute(sql_trimmed).await?;

            Ok(QueryResult {
                rows: Vec::new(),
                columns: Vec::new(),
                rows_affected: result.rows_affected(),
                execution_time_ms: start_time.elapsed().as_millis(),
            })
        }
    }
}

// ============================================================================
// Migration Operations
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationRequest {
    pub connection_id: String,
    pub statements: Vec<String>,
    pub dry_run: bool,
    pub lock_timeout_ms: Option<u32>,
    pub statement_timeout_ms: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatementError {
    pub code: Option<String>,
    pub message: String,
    pub detail: Option<String>,
    pub hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatementResult {
    pub sql: String,
    pub ok: bool,
    pub duration_ms: f64,
    pub rows_affected: Option<u64>,
    pub error: Option<StatementError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationResult {
    pub ok: bool,
    pub dry_run: bool,
    pub committed: bool,
    pub duration_ms: f64,
    pub statements: Vec<StatementResult>,
    pub lock_timeout_ms: u32,
    pub statement_timeout_ms: u32,
}

pub struct MigrationOperations;

impl MigrationOperations {
    pub async fn execute_migration(
        pool: &PgPool,
        statements: &[String],
        dry_run: bool,
        lock_timeout_ms: Option<u32>,
        statement_timeout_ms: Option<u32>,
    ) -> Result<MigrationResult> {
        let lock_timeout = lock_timeout_ms.unwrap_or(5000);
        let stmt_timeout = statement_timeout_ms.unwrap_or(30000);
        let total_start = Instant::now();

        // Acquire a connection and begin transaction
        let mut tx = pool.begin().await?;

        // Set session-local timeouts
        let setup_sqls = [
            format!("SET LOCAL lock_timeout = '{lock_timeout}ms'"),
            format!("SET LOCAL statement_timeout = '{stmt_timeout}ms'"),
            format!("SET LOCAL idle_in_transaction_session_timeout = '60s'"),
            "SET LOCAL application_name = 'tusker-migration'".to_string(),
        ];

        for sql in &setup_sqls {
            if let Err(e) = sqlx::query(sql).execute(&mut *tx).await {
                return Ok(MigrationResult {
                    ok: false,
                    dry_run,
                    committed: false,
                    duration_ms: total_start.elapsed().as_secs_f64() * 1000.0,
                    statements: vec![StatementResult {
                        sql: sql.clone(),
                        ok: false,
                        duration_ms: 0.0,
                        rows_affected: None,
                        error: Some(extract_pg_error(&e)),
                    }],
                    lock_timeout_ms: lock_timeout,
                    statement_timeout_ms: stmt_timeout,
                });
            }
        }

        let mut results: Vec<StatementResult> = Vec::new();
        let mut all_ok = true;

        for (i, stmt) in statements.iter().enumerate() {
            let trimmed = stmt.trim();
            if trimmed.is_empty() {
                continue;
            }

            let stmt_start = Instant::now();

            if dry_run {
                // Use savepoints so we can recover from errors and continue
                // validating subsequent statements. Don't roll back on success —
                // let effects accumulate so later statements see prior changes
                // (e.g. RENAME TABLE followed by ALTER on the new name).
                // The entire transaction is rolled back at the end.
                let sp_name = format!("s{i}");
                let _ = sqlx::query(&format!("SAVEPOINT {sp_name}"))
                    .execute(&mut *tx)
                    .await;

                match sqlx::query(trimmed).execute(&mut *tx).await {
                    Ok(r) => {
                        let duration = stmt_start.elapsed().as_secs_f64() * 1000.0;
                        results.push(StatementResult {
                            sql: trimmed.to_string(),
                            ok: true,
                            duration_ms: duration,
                            rows_affected: Some(r.rows_affected()),
                            error: None,
                        });
                    }
                    Err(e) => {
                        let duration = stmt_start.elapsed().as_secs_f64() * 1000.0;
                        all_ok = false;
                        results.push(StatementResult {
                            sql: trimmed.to_string(),
                            ok: false,
                            duration_ms: duration,
                            rows_affected: None,
                            error: Some(extract_pg_error(&e)),
                        });
                        // Roll back only on error so the transaction stays usable
                        let _ = sqlx::query(&format!("ROLLBACK TO SAVEPOINT {sp_name}"))
                            .execute(&mut *tx)
                            .await;
                    }
                }
            } else {
                // Apply mode: execute directly, abort on first error
                match sqlx::query(trimmed).execute(&mut *tx).await {
                    Ok(r) => {
                        let duration = stmt_start.elapsed().as_secs_f64() * 1000.0;
                        results.push(StatementResult {
                            sql: trimmed.to_string(),
                            ok: true,
                            duration_ms: duration,
                            rows_affected: Some(r.rows_affected()),
                            error: None,
                        });
                    }
                    Err(e) => {
                        let duration = stmt_start.elapsed().as_secs_f64() * 1000.0;
                        results.push(StatementResult {
                            sql: trimmed.to_string(),
                            ok: false,
                            duration_ms: duration,
                            rows_affected: None,
                            error: Some(extract_pg_error(&e)),
                        });
                        // Transaction is aborted — drop it (auto-rollback)
                        return Ok(MigrationResult {
                            ok: false,
                            dry_run,
                            committed: false,
                            duration_ms: total_start.elapsed().as_secs_f64() * 1000.0,
                            statements: results,
                            lock_timeout_ms: lock_timeout,
                            statement_timeout_ms: stmt_timeout,
                        });
                    }
                }
            }
        }

        // Finalize: rollback for dry-run, commit for apply
        let committed = if dry_run {
            tx.rollback().await.ok();
            false
        } else {
            match tx.commit().await {
                Ok(_) => true,
                Err(e) => {
                    results.push(StatementResult {
                        sql: "COMMIT".to_string(),
                        ok: false,
                        duration_ms: 0.0,
                        rows_affected: None,
                        error: Some(extract_pg_error(&e)),
                    });
                    all_ok = false;
                    false
                }
            }
        };

        Ok(MigrationResult {
            ok: all_ok,
            dry_run,
            committed,
            duration_ms: total_start.elapsed().as_secs_f64() * 1000.0,
            statements: results,
            lock_timeout_ms: lock_timeout,
            statement_timeout_ms: stmt_timeout,
        })
    }
}

/// Extract structured error info from a sqlx::Error
fn extract_pg_error(err: &sqlx::Error) -> StatementError {
    match err {
        sqlx::Error::Database(db_err) => {
            let pg_code = db_err.code().map(|c| c.to_string());
            let detail = db_err
                .try_downcast_ref::<sqlx::postgres::PgDatabaseError>()
                .and_then(|pg| pg.detail().map(|s| s.to_string()));
            let hint = db_err
                .try_downcast_ref::<sqlx::postgres::PgDatabaseError>()
                .and_then(|pg| pg.hint().map(|s| s.to_string()));

            StatementError {
                code: pg_code,
                message: db_err.message().to_string(),
                detail,
                hint,
            }
        }
        _ => StatementError {
            code: None,
            message: err.to_string(),
            detail: None,
            hint: None,
        },
    }
}

/// Convert PostgreSQL rows to JSON
fn rows_to_json(rows: &[PgRow]) -> (Vec<serde_json::Map<String, JsonValue>>, Vec<ColumnMeta>) {
    if rows.is_empty() {
        return (Vec::new(), Vec::new());
    }

    let columns: Vec<ColumnMeta> = rows[0]
        .columns()
        .iter()
        .map(|col| ColumnMeta {
            name: col.name().to_string(),
            data_type: col.type_info().name().to_string(),
        })
        .collect();

    let json_rows: Vec<serde_json::Map<String, JsonValue>> = rows
        .iter()
        .map(|row| {
            let mut map = serde_json::Map::new();
            for (i, col) in row.columns().iter().enumerate() {
                let value = pg_value_to_json(row, i, col.type_info().name());
                map.insert(col.name().to_string(), value);
            }
            map
        })
        .collect();

    (json_rows, columns)
}

/// Convert a PostgreSQL value to JSON
fn pg_value_to_json(row: &PgRow, idx: usize, type_name: &str) -> JsonValue {
    // Try to get the value based on the type
    match type_name {
        "BOOL" => row
            .try_get::<Option<bool>, _>(idx)
            .ok()
            .flatten()
            .map(JsonValue::Bool)
            .unwrap_or(JsonValue::Null),

        "INT2" => row
            .try_get::<Option<i16>, _>(idx)
            .ok()
            .flatten()
            .map(|v| JsonValue::Number(v.into()))
            .unwrap_or(JsonValue::Null),

        "INT4" => row
            .try_get::<Option<i32>, _>(idx)
            .ok()
            .flatten()
            .map(|v| JsonValue::Number(v.into()))
            .unwrap_or(JsonValue::Null),

        "INT8" => row
            .try_get::<Option<i64>, _>(idx)
            .ok()
            .flatten()
            .map(|v| JsonValue::Number(v.into()))
            .unwrap_or(JsonValue::Null),

        "FLOAT4" => row
            .try_get::<Option<f32>, _>(idx)
            .ok()
            .flatten()
            .and_then(|v| serde_json::Number::from_f64(v as f64))
            .map(JsonValue::Number)
            .unwrap_or(JsonValue::Null),

        "FLOAT8" => row
            .try_get::<Option<f64>, _>(idx)
            .ok()
            .flatten()
            .and_then(serde_json::Number::from_f64)
            .map(JsonValue::Number)
            .unwrap_or(JsonValue::Null),

        "JSON" | "JSONB" => row
            .try_get::<Option<JsonValue>, _>(idx)
            .ok()
            .flatten()
            .unwrap_or(JsonValue::Null),

        "UUID" => row
            .try_get::<Option<uuid::Uuid>, _>(idx)
            .ok()
            .flatten()
            .map(|v| JsonValue::String(v.to_string()))
            .unwrap_or(JsonValue::Null),

        "BYTEA" => row
            .try_get::<Option<Vec<u8>>, _>(idx)
            .ok()
            .flatten()
            .map(|v| JsonValue::String(format!("\\x{}", hex::encode(v))))
            .unwrap_or(JsonValue::Null),

        "TIMESTAMPTZ" => row
            .try_get::<Option<chrono::DateTime<chrono::Utc>>, _>(idx)
            .ok()
            .flatten()
            .map(|v| JsonValue::String(v.to_rfc3339()))
            .unwrap_or(JsonValue::Null),

        "TIMESTAMP" => row
            .try_get::<Option<chrono::NaiveDateTime>, _>(idx)
            .ok()
            .flatten()
            .map(|v| JsonValue::String(v.to_string()))
            .unwrap_or(JsonValue::Null),

        "DATE" => row
            .try_get::<Option<chrono::NaiveDate>, _>(idx)
            .ok()
            .flatten()
            .map(|v| JsonValue::String(v.to_string()))
            .unwrap_or(JsonValue::Null),

        "TIME" => row
            .try_get::<Option<chrono::NaiveTime>, _>(idx)
            .ok()
            .flatten()
            .map(|v| JsonValue::String(v.to_string()))
            .unwrap_or(JsonValue::Null),

        _ => {
            // Try to get as string first
            if let Ok(Some(s)) = row.try_get::<Option<String>, _>(idx) {
                return JsonValue::String(s);
            }

            // For enum types and other USER-DEFINED types, try to get raw value
            // PostgreSQL enum values are stored as strings but SQLx might not decode them directly
            use sqlx::Row as _;
            if let Ok(value_ref) = row.try_get_raw(idx) {
                use sqlx::ValueRef;
                if value_ref.is_null() {
                    return JsonValue::Null;
                }
                // Try to decode as string from the raw bytes
                use sqlx::Decode;
                if let Ok(s) = <String as Decode<sqlx::Postgres>>::decode(value_ref) {
                    return JsonValue::String(s);
                }
            }

            JsonValue::Null
        }
    }
}

/// Convert a JSON value to a SQL string (with proper escaping)
fn json_value_to_sql(value: &JsonValue) -> String {
    match value {
        JsonValue::Null => "NULL".to_string(),
        JsonValue::Bool(b) => if *b { "TRUE" } else { "FALSE" }.to_string(),
        JsonValue::Number(n) => n.to_string(),
        JsonValue::String(s) => format!("'{}'", escape_sql_string(s)),
        JsonValue::Array(_) | JsonValue::Object(_) => {
            format!("'{}'::jsonb", escape_sql_string(&value.to_string()))
        }
    }
}

/// Escape a string for SQL (prevent SQL injection)
fn escape_sql_string(s: &str) -> String {
    s.replace('\'', "''")
}

/// Quote an identifier to prevent SQL injection
fn quote_identifier(identifier: &str) -> String {
    format!("\"{}\"", identifier.replace('"', "\"\""))
}
