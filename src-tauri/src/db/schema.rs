use crate::error::Result;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaInfo {
    pub name: String,
    pub owner: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableInfo {
    pub schema: String,
    pub name: String,
    pub table_type: TableType,
    pub estimated_row_count: Option<i64>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TableType {
    Table,
    View,
    MaterializedView,
    ForeignTable,
}

impl From<String> for TableType {
    fn from(s: String) -> Self {
        match s.as_str() {
            "VIEW" => TableType::View,
            "MATERIALIZED VIEW" => TableType::MaterializedView,
            "FOREIGN TABLE" => TableType::ForeignTable,
            _ => TableType::Table,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub udt_name: String,
    pub is_nullable: bool,
    pub is_primary_key: bool,
    pub is_unique: bool,
    pub is_foreign_key: bool,
    pub default_value: Option<String>,
    pub character_maximum_length: Option<i32>,
    pub numeric_precision: Option<i32>,
    pub numeric_scale: Option<i32>,
    pub ordinal_position: i32,
    pub description: Option<String>,
    pub foreign_key_info: Option<ForeignKeyInfo>,
    pub enum_values: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForeignKeyInfo {
    pub constraint_name: String,
    pub referenced_schema: String,
    pub referenced_table: String,
    pub referenced_column: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexInfo {
    pub name: String,
    pub is_unique: bool,
    pub is_primary: bool,
    pub columns: Vec<String>,
    pub index_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConstraintInfo {
    pub name: String,
    pub constraint_type: ConstraintType,
    pub columns: Vec<String>,
    pub definition: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConstraintType {
    PrimaryKey,
    ForeignKey,
    Unique,
    Check,
    Exclusion,
}

impl From<String> for ConstraintType {
    fn from(s: String) -> Self {
        match s.as_str() {
            "PRIMARY KEY" => ConstraintType::PrimaryKey,
            "FOREIGN KEY" => ConstraintType::ForeignKey,
            "UNIQUE" => ConstraintType::Unique,
            "CHECK" => ConstraintType::Check,
            "EXCLUSION" => ConstraintType::Exclusion,
            _ => ConstraintType::Check,
        }
    }
}

pub struct SchemaIntrospector;

impl SchemaIntrospector {
    /// Get all schemas in the database
    pub async fn get_schemas(pool: &PgPool) -> Result<Vec<SchemaInfo>> {
        let schemas = sqlx::query_as::<_, (String, Option<String>)>(
            r#"
            SELECT
                schema_name,
                schema_owner
            FROM information_schema.schemata
            WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
              AND schema_name NOT LIKE 'pg_temp_%'
              AND schema_name NOT LIKE 'pg_toast_temp_%'
            ORDER BY schema_name
            "#,
        )
        .fetch_all(pool)
        .await?;

        Ok(schemas
            .into_iter()
            .map(|(name, owner)| SchemaInfo { name, owner })
            .collect())
    }

    /// Get all tables in a schema
    pub async fn get_tables(pool: &PgPool, schema: &str) -> Result<Vec<TableInfo>> {
        let tables = sqlx::query_as::<_, (String, String, String, Option<i64>, Option<String>)>(
            r#"
            SELECT
                t.table_schema,
                t.table_name,
                t.table_type,
                (
                    SELECT reltuples::bigint
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = t.table_schema AND c.relname = t.table_name
                ) as estimated_row_count,
                obj_description(
                    (quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))::regclass,
                    'pg_class'
                ) as description
            FROM information_schema.tables t
            WHERE t.table_schema = $1
              AND t.table_type IN ('BASE TABLE', 'VIEW')
            ORDER BY t.table_name
            "#,
        )
        .bind(schema)
        .fetch_all(pool)
        .await?;

        // Also get materialized views
        let mat_views = sqlx::query_as::<_, (String, String, Option<i64>, Option<String>)>(
            r#"
            SELECT
                schemaname,
                matviewname,
                (
                    SELECT reltuples::bigint
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = schemaname AND c.relname = matviewname
                ) as estimated_row_count,
                obj_description(
                    (quote_ident(schemaname) || '.' || quote_ident(matviewname))::regclass,
                    'pg_class'
                ) as description
            FROM pg_matviews
            WHERE schemaname = $1
            ORDER BY matviewname
            "#,
        )
        .bind(schema)
        .fetch_all(pool)
        .await?;

        let mut result: Vec<TableInfo> = tables
            .into_iter()
            .map(
                |(schema, name, table_type, estimated_row_count, description)| TableInfo {
                    schema,
                    name,
                    table_type: table_type.into(),
                    estimated_row_count,
                    description,
                },
            )
            .collect();

        result.extend(mat_views.into_iter().map(
            |(schema, name, estimated_row_count, description)| TableInfo {
                schema,
                name,
                table_type: TableType::MaterializedView,
                estimated_row_count,
                description,
            },
        ));

        result.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(result)
    }

    /// Get columns for a table
    pub async fn get_columns(pool: &PgPool, schema: &str, table: &str) -> Result<Vec<ColumnInfo>> {
        // Get primary key columns
        let pk_columns: Vec<String> = sqlx::query_scalar(
            r#"
            SELECT a.attname
            FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE i.indrelid = (quote_ident($1) || '.' || quote_ident($2))::regclass
              AND i.indisprimary
            "#,
        )
        .bind(schema)
        .bind(table)
        .fetch_all(pool)
        .await?;

        // Get unique columns
        let unique_columns: Vec<String> = sqlx::query_scalar(
            r#"
            SELECT a.attname
            FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE i.indrelid = (quote_ident($1) || '.' || quote_ident($2))::regclass
              AND i.indisunique
              AND NOT i.indisprimary
            "#,
        )
        .bind(schema)
        .bind(table)
        .fetch_all(pool)
        .await?;

        // Get foreign key columns with their references
        let fk_info: Vec<(String, String, String, String, String)> = sqlx::query_as(
            r#"
            SELECT
                kcu.column_name,
                tc.constraint_name,
                ccu.table_schema AS referenced_schema,
                ccu.table_name AS referenced_table,
                ccu.column_name AS referenced_column
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = $1
              AND tc.table_name = $2
            "#,
        )
        .bind(schema)
        .bind(table)
        .fetch_all(pool)
        .await?;

        let fk_map: std::collections::HashMap<String, ForeignKeyInfo> = fk_info
            .into_iter()
            .map(
                |(col, constraint_name, ref_schema, ref_table, ref_col)| {
                    (
                        col,
                        ForeignKeyInfo {
                            constraint_name,
                            referenced_schema: ref_schema,
                            referenced_table: ref_table,
                            referenced_column: ref_col,
                        },
                    )
                },
            )
            .collect();

        // Get column details
        let columns = sqlx::query_as::<_, (String, String, String, String, Option<String>, Option<i32>, Option<i32>, Option<i32>, i32)>(
            r#"
            SELECT
                c.column_name,
                c.data_type,
                c.udt_name,
                c.is_nullable,
                c.column_default,
                c.character_maximum_length,
                c.numeric_precision,
                c.numeric_scale,
                c.ordinal_position
            FROM information_schema.columns c
            WHERE c.table_schema = $1
              AND c.table_name = $2
            ORDER BY c.ordinal_position
            "#,
        )
        .bind(schema)
        .bind(table)
        .fetch_all(pool)
        .await?;

        // Get column descriptions
        let descriptions: Vec<(String, Option<String>)> = sqlx::query_as(
            r#"
            SELECT
                a.attname,
                col_description(a.attrelid, a.attnum)
            FROM pg_attribute a
            JOIN pg_class c ON a.attrelid = c.oid
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE n.nspname = $1
              AND c.relname = $2
              AND a.attnum > 0
              AND NOT a.attisdropped
            "#,
        )
        .bind(schema)
        .bind(table)
        .fetch_all(pool)
        .await?;

        let desc_map: std::collections::HashMap<String, Option<String>> =
            descriptions.into_iter().collect();

        // Find all enum types used in this table (USER-DEFINED data_type indicates enum or composite)
        let enum_udt_names: Vec<String> = columns
            .iter()
            .filter(|(_, data_type, _, _, _, _, _, _, _)| data_type == "USER-DEFINED")
            .map(|(_, _, udt_name, _, _, _, _, _, _)| udt_name.clone())
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();

        // Fetch enum values for each enum type
        let mut enum_values_map: std::collections::HashMap<String, Vec<String>> =
            std::collections::HashMap::new();

        for udt_name in enum_udt_names {
            let enum_values: Vec<(String,)> = sqlx::query_as(
                r#"
                SELECT e.enumlabel
                FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid
                WHERE t.typname = $1
                ORDER BY e.enumsortorder
                "#,
            )
            .bind(&udt_name)
            .fetch_all(pool)
            .await
            .unwrap_or_default();

            if !enum_values.is_empty() {
                enum_values_map.insert(
                    udt_name,
                    enum_values.into_iter().map(|(v,)| v).collect(),
                );
            }
        }

        Ok(columns
            .into_iter()
            .map(
                |(
                    name,
                    data_type,
                    udt_name,
                    is_nullable,
                    default_value,
                    char_max_len,
                    num_precision,
                    num_scale,
                    ordinal_position,
                )| {
                    let enum_values = enum_values_map.get(&udt_name).cloned();
                    ColumnInfo {
                        is_primary_key: pk_columns.contains(&name),
                        is_unique: unique_columns.contains(&name),
                        is_foreign_key: fk_map.contains_key(&name),
                        foreign_key_info: fk_map.get(&name).cloned(),
                        description: desc_map.get(&name).cloned().flatten(),
                        name,
                        data_type,
                        udt_name,
                        is_nullable: is_nullable == "YES",
                        default_value,
                        character_maximum_length: char_max_len,
                        numeric_precision: num_precision,
                        numeric_scale: num_scale,
                        ordinal_position,
                        enum_values,
                    }
                },
            )
            .collect())
    }

    /// Get exact row count for a table
    pub async fn get_row_count(pool: &PgPool, schema: &str, table: &str) -> Result<i64> {
        let query = format!(
            "SELECT COUNT(*) FROM {}.{}",
            quote_identifier(schema),
            quote_identifier(table)
        );

        let count: (i64,) = sqlx::query_as(&query).fetch_one(pool).await?;

        Ok(count.0)
    }

    /// Get indexes for a table
    pub async fn get_indexes(pool: &PgPool, schema: &str, table: &str) -> Result<Vec<IndexInfo>> {
        let indexes = sqlx::query_as::<_, (String, bool, bool, String, Vec<String>)>(
            r#"
            SELECT
                i.relname AS index_name,
                ix.indisunique AS is_unique,
                ix.indisprimary AS is_primary,
                am.amname AS index_type,
                ARRAY_AGG(a.attname ORDER BY array_position(ix.indkey, a.attnum)) AS columns
            FROM pg_index ix
            JOIN pg_class i ON i.oid = ix.indexrelid
            JOIN pg_class t ON t.oid = ix.indrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            JOIN pg_am am ON am.oid = i.relam
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
            WHERE n.nspname = $1
              AND t.relname = $2
            GROUP BY i.relname, ix.indisunique, ix.indisprimary, am.amname
            ORDER BY i.relname
            "#,
        )
        .bind(schema)
        .bind(table)
        .fetch_all(pool)
        .await?;

        Ok(indexes
            .into_iter()
            .map(|(name, is_unique, is_primary, index_type, columns)| IndexInfo {
                name,
                is_unique,
                is_primary,
                columns,
                index_type,
            })
            .collect())
    }

    /// Get constraints for a table
    pub async fn get_constraints(
        pool: &PgPool,
        schema: &str,
        table: &str,
    ) -> Result<Vec<ConstraintInfo>> {
        let constraints = sqlx::query_as::<_, (String, String, Vec<String>, Option<String>)>(
            r#"
            SELECT
                tc.constraint_name,
                tc.constraint_type,
                ARRAY_AGG(kcu.column_name ORDER BY kcu.ordinal_position) AS columns,
                pg_get_constraintdef(pgc.oid) AS definition
            FROM information_schema.table_constraints tc
            LEFT JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            LEFT JOIN pg_constraint pgc
                ON pgc.conname = tc.constraint_name
                AND pgc.connamespace = (SELECT oid FROM pg_namespace WHERE nspname = tc.table_schema)
            WHERE tc.table_schema = $1
              AND tc.table_name = $2
            GROUP BY tc.constraint_name, tc.constraint_type, pgc.oid
            ORDER BY tc.constraint_name
            "#,
        )
        .bind(schema)
        .bind(table)
        .fetch_all(pool)
        .await?;

        Ok(constraints
            .into_iter()
            .map(|(name, constraint_type, columns, definition)| ConstraintInfo {
                name,
                constraint_type: constraint_type.into(),
                columns,
                definition,
            })
            .collect())
    }
}

/// Quote an identifier to prevent SQL injection
fn quote_identifier(identifier: &str) -> String {
    format!("\"{}\"", identifier.replace('"', "\"\""))
}
