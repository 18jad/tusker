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
pub struct TableColumnsInfo {
    pub schema: String,
    pub table: String,
    pub columns: Vec<ColumnInfo>,
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
                n.nspname,
                pg_catalog.pg_get_userbyid(n.nspowner)
            FROM pg_catalog.pg_namespace n
            WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
              AND n.nspname NOT LIKE 'pg_temp_%'
              AND n.nspname NOT LIKE 'pg_toast_temp_%'
            ORDER BY n.nspname
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
        // Single pg_catalog query covers tables, views, mat views, and foreign tables
        let rows = sqlx::query_as::<_, (String, String, String, Option<i64>, Option<String>)>(
            r#"
            SELECT
                n.nspname,
                c.relname,
                CASE c.relkind
                    WHEN 'r' THEN 'BASE TABLE'
                    WHEN 'v' THEN 'VIEW'
                    WHEN 'm' THEN 'MATERIALIZED VIEW'
                    WHEN 'f' THEN 'FOREIGN TABLE'
                    ELSE 'BASE TABLE'
                END,
                c.reltuples::bigint,
                obj_description(c.oid, 'pg_class')
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = $1
              AND c.relkind IN ('r', 'v', 'm', 'f')
            ORDER BY c.relname
            "#,
        )
        .bind(schema)
        .fetch_all(pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|(schema, name, table_type, estimated_row_count, description)| TableInfo {
                schema,
                name,
                table_type: table_type.into(),
                estimated_row_count,
                description,
            })
            .collect())
    }

    /// Get columns for a table
    pub async fn get_columns(pool: &PgPool, schema: &str, table: &str) -> Result<Vec<ColumnInfo>> {
        // Two queries instead of six: one big pg_catalog query for all column metadata,
        // and one for enum values. Both run concurrently.
        let (columns_result, enums_result) = tokio::join!(
            // Single query: columns + PK/unique/FK info + descriptions via pg_catalog
            sqlx::query_as::<_, (
                String, String, String, bool, Option<String>,
                Option<i32>, Option<i32>, Option<i32>, i16,
                Option<String>, bool, bool,
                Option<String>, Option<String>, Option<String>, Option<String>,
            )>(
                r#"
                WITH rel AS (
                    SELECT c.oid, c.relname
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = $1 AND c.relname = $2
                ),
                pk_cols AS (
                    SELECT a.attnum
                    FROM pg_index i
                    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                    WHERE i.indrelid = (SELECT oid FROM rel) AND i.indisprimary
                ),
                uq_cols AS (
                    SELECT DISTINCT a.attnum
                    FROM pg_index i
                    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                    WHERE i.indrelid = (SELECT oid FROM rel) AND i.indisunique AND NOT i.indisprimary
                ),
                fk_info AS (
                    SELECT
                        unnest(con.conkey) AS attnum,
                        con.conname,
                        rn.nspname AS ref_schema,
                        rc.relname AS ref_table,
                        ra.attname AS ref_column
                    FROM pg_constraint con
                    JOIN pg_class rc ON rc.oid = con.confrelid
                    JOIN pg_namespace rn ON rn.oid = rc.relnamespace
                    JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS fk(attnum, ord) ON true
                    JOIN pg_attribute ra ON ra.attrelid = con.confrelid AND ra.attnum = fk.attnum
                    WHERE con.conrelid = (SELECT oid FROM rel) AND con.contype = 'f'
                )
                SELECT
                    a.attname,
                    format_type(a.atttypid, a.atttypmod) AS data_type,
                    t.typname AS udt_name,
                    NOT a.attnotnull AS is_nullable,
                    pg_get_expr(ad.adbin, ad.adrelid) AS default_value,
                    information_schema._pg_char_max_length(a.atttypid, a.atttypmod)::int4,
                    information_schema._pg_numeric_precision(a.atttypid, a.atttypmod)::int4,
                    information_schema._pg_numeric_scale(a.atttypid, a.atttypmod)::int4,
                    a.attnum,
                    col_description(a.attrelid, a.attnum) AS description,
                    (a.attnum IN (SELECT attnum FROM pk_cols)) AS is_pk,
                    (a.attnum IN (SELECT attnum FROM uq_cols)) AS is_unique,
                    fk.conname AS fk_constraint,
                    fk.ref_schema,
                    fk.ref_table,
                    fk.ref_column
                FROM pg_attribute a
                JOIN pg_type t ON t.oid = a.atttypid
                LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
                LEFT JOIN fk_info fk ON fk.attnum = a.attnum
                WHERE a.attrelid = (SELECT oid FROM rel)
                  AND a.attnum > 0
                  AND NOT a.attisdropped
                ORDER BY a.attnum
                "#,
            )
            .bind(schema)
            .bind(table)
            .fetch_all(pool),

            // Enum values (only for types used in this database)
            sqlx::query_as::<_, (String, String)>(
                r#"
                SELECT t.typname, e.enumlabel
                FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid
                ORDER BY t.typname, e.enumsortorder
                "#,
            )
            .fetch_all(pool),
        );

        let columns = columns_result?;
        let all_enums = enums_result.unwrap_or_default();

        // Build enum values map
        let mut enum_values_map: std::collections::HashMap<String, Vec<String>> =
            std::collections::HashMap::new();
        for (type_name, label) in all_enums {
            enum_values_map.entry(type_name).or_default().push(label);
        }

        Ok(columns
            .into_iter()
            .map(|(
                name, data_type, udt_name, is_nullable, default_value,
                char_max_len, num_precision, num_scale, ordinal_position,
                description, is_pk, is_unique,
                fk_constraint, fk_ref_schema, fk_ref_table, fk_ref_column,
            )| {
                let foreign_key_info = fk_constraint.map(|constraint_name| ForeignKeyInfo {
                    constraint_name,
                    referenced_schema: fk_ref_schema.unwrap_or_default(),
                    referenced_table: fk_ref_table.unwrap_or_default(),
                    referenced_column: fk_ref_column.unwrap_or_default(),
                });
                let enum_values = enum_values_map.get(&udt_name).cloned();
                ColumnInfo {
                    is_primary_key: is_pk,
                    is_unique,
                    is_foreign_key: foreign_key_info.is_some(),
                    foreign_key_info,
                    description,
                    name,
                    data_type,
                    udt_name,
                    is_nullable,
                    default_value,
                    character_maximum_length: char_max_len,
                    numeric_precision: num_precision,
                    numeric_scale: num_scale,
                    ordinal_position: ordinal_position as i32,
                    enum_values,
                }
            })
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
                con.conname,
                CASE con.contype
                    WHEN 'p' THEN 'PRIMARY KEY'
                    WHEN 'f' THEN 'FOREIGN KEY'
                    WHEN 'u' THEN 'UNIQUE'
                    WHEN 'c' THEN 'CHECK'
                    WHEN 'x' THEN 'EXCLUSION'
                    ELSE 'CHECK'
                END,
                ARRAY(
                    SELECT a.attname
                    FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
                    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum
                    ORDER BY k.ord
                ),
                pg_get_constraintdef(con.oid)
            FROM pg_constraint con
            JOIN pg_class c ON c.oid = con.conrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = $1
              AND c.relname = $2
            ORDER BY con.conname
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaWithTables {
    pub name: String,
    pub owner: Option<String>,
    pub tables: Vec<TableInfo>,
}

impl SchemaIntrospector {
    /// Get all schemas with their tables in a single operation
    pub async fn get_schemas_with_tables(pool: &PgPool) -> Result<Vec<SchemaWithTables>> {
        // Run all three queries concurrently
        let (schemas_result, tables_result, mat_views_result) = tokio::join!(
            Self::get_schemas(pool),
            // Fetch tables for ALL schemas at once using pg_catalog (faster than information_schema)
            sqlx::query_as::<_, (String, String, String, Option<i64>, Option<String>)>(
                r#"
                SELECT
                    n.nspname AS table_schema,
                    c.relname AS table_name,
                    CASE c.relkind
                        WHEN 'r' THEN 'BASE TABLE'
                        WHEN 'v' THEN 'VIEW'
                        WHEN 'f' THEN 'FOREIGN TABLE'
                        ELSE 'BASE TABLE'
                    END AS table_type,
                    c.reltuples::bigint AS estimated_row_count,
                    obj_description(c.oid, 'pg_class') AS description
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
                  AND n.nspname NOT LIKE 'pg_temp_%'
                  AND n.nspname NOT LIKE 'pg_toast_temp_%'
                  AND c.relkind IN ('r', 'v', 'f')
                ORDER BY n.nspname, c.relname
                "#,
            )
            .fetch_all(pool),
            // Materialized views
            sqlx::query_as::<_, (String, String, Option<i64>, Option<String>)>(
                r#"
                SELECT
                    n.nspname,
                    c.relname,
                    c.reltuples::bigint,
                    obj_description(c.oid, 'pg_class')
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relkind = 'm'
                  AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
                ORDER BY n.nspname, c.relname
                "#,
            )
            .fetch_all(pool),
        );

        let schemas = schemas_result?;
        let all_tables = tables_result?;
        let mat_views = mat_views_result.unwrap_or_default();

        // Group tables by schema
        let mut tables_by_schema: std::collections::HashMap<String, Vec<TableInfo>> =
            std::collections::HashMap::new();

        for (schema, name, table_type, estimated_row_count, description) in all_tables {
            tables_by_schema
                .entry(schema.clone())
                .or_default()
                .push(TableInfo {
                    schema,
                    name,
                    table_type: table_type.into(),
                    estimated_row_count,
                    description,
                });
        }

        for (schema, name, estimated_row_count, description) in mat_views {
            tables_by_schema
                .entry(schema.clone())
                .or_default()
                .push(TableInfo {
                    schema,
                    name,
                    table_type: TableType::MaterializedView,
                    estimated_row_count,
                    description,
                });
        }

        // Sort tables within each schema
        for tables in tables_by_schema.values_mut() {
            tables.sort_by(|a, b| a.name.cmp(&b.name));
        }

        Ok(schemas
            .into_iter()
            .map(|s| SchemaWithTables {
                tables: tables_by_schema.remove(&s.name).unwrap_or_default(),
                name: s.name,
                owner: s.owner,
            })
            .collect())
    }
}

impl SchemaIntrospector {
    /// Get all columns for all tables across given schemas in a single query.
    /// Returns a flat list of (schema, table, columns) tuples — no N+1 queries.
    pub async fn get_all_columns(
        pool: &PgPool,
        schema_names: &[String],
    ) -> Result<Vec<TableColumnsInfo>> {
        use sqlx::Row;

        let columns_future = sqlx::query(
                r#"
                WITH pk_cols AS (
                    SELECT i.indrelid, a.attnum
                    FROM pg_index i
                    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                    JOIN pg_class c ON c.oid = i.indrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE i.indisprimary
                      AND n.nspname = ANY($1)
                      AND c.relkind IN ('r', 'v', 'm', 'f')
                ),
                uq_cols AS (
                    SELECT DISTINCT i.indrelid, a.attnum
                    FROM pg_index i
                    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                    JOIN pg_class c ON c.oid = i.indrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE i.indisunique AND NOT i.indisprimary
                      AND n.nspname = ANY($1)
                      AND c.relkind IN ('r', 'v', 'm', 'f')
                ),
                fk_info AS (
                    SELECT
                        con.conrelid,
                        unnest(con.conkey) AS attnum,
                        con.conname,
                        rn.nspname AS ref_schema,
                        rc.relname AS ref_table,
                        ra.attname AS ref_column
                    FROM pg_constraint con
                    JOIN pg_class rc ON rc.oid = con.confrelid
                    JOIN pg_namespace rn ON rn.oid = rc.relnamespace
                    JOIN pg_class sc ON sc.oid = con.conrelid
                    JOIN pg_namespace sn ON sn.oid = sc.relnamespace
                    JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS fk(attnum, ord) ON true
                    JOIN pg_attribute ra ON ra.attrelid = con.confrelid AND ra.attnum = fk.attnum
                    WHERE con.contype = 'f'
                      AND sn.nspname = ANY($1)
                )
                SELECT
                    n.nspname AS schema_name,
                    c.relname AS table_name,
                    a.attname AS col_name,
                    format_type(a.atttypid, a.atttypmod) AS data_type,
                    t.typname AS udt_name,
                    NOT a.attnotnull AS is_nullable,
                    pg_get_expr(ad.adbin, ad.adrelid) AS default_value,
                    information_schema._pg_char_max_length(a.atttypid, a.atttypmod)::int4 AS char_max_len,
                    information_schema._pg_numeric_precision(a.atttypid, a.atttypmod)::int4 AS num_precision,
                    information_schema._pg_numeric_scale(a.atttypid, a.atttypmod)::int4 AS num_scale,
                    a.attnum AS ordinal_position,
                    col_description(a.attrelid, a.attnum) AS description,
                    (EXISTS (SELECT 1 FROM pk_cols pk WHERE pk.indrelid = a.attrelid AND pk.attnum = a.attnum)) AS is_pk,
                    (EXISTS (SELECT 1 FROM uq_cols uq WHERE uq.indrelid = a.attrelid AND uq.attnum = a.attnum)) AS is_unique,
                    fk.conname AS fk_constraint,
                    fk.ref_schema,
                    fk.ref_table,
                    fk.ref_column
                FROM pg_attribute a
                JOIN pg_class c ON c.oid = a.attrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                JOIN pg_type t ON t.oid = a.atttypid
                LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
                LEFT JOIN fk_info fk ON fk.conrelid = a.attrelid AND fk.attnum = a.attnum
                WHERE n.nspname = ANY($1)
                  AND c.relkind IN ('r', 'v', 'm', 'f')
                  AND a.attnum > 0
                  AND NOT a.attisdropped
                ORDER BY n.nspname, c.relname, a.attnum
                "#,
            )
            .bind(schema_names)
            .fetch_all(pool);

        let enums_future = sqlx::query_as::<_, (String, String)>(
                r#"
                SELECT t.typname, e.enumlabel
                FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid
                ORDER BY t.typname, e.enumsortorder
                "#,
            )
            .fetch_all(pool);

        let (columns_result, enums_result) = tokio::join!(columns_future, enums_future);

        let rows = columns_result?;
        let all_enums = enums_result.unwrap_or_default();

        let mut enum_values_map: std::collections::HashMap<String, Vec<String>> =
            std::collections::HashMap::new();
        for (type_name, label) in all_enums {
            enum_values_map.entry(type_name).or_default().push(label);
        }

        // Group rows by (schema, table)
        let mut tables: Vec<TableColumnsInfo> = Vec::new();
        let mut current_key: Option<(String, String)> = None;

        for row in rows {
            let schema_name: String = row.get("schema_name");
            let table_name: String = row.get("table_name");
            let udt_name: String = row.get("udt_name");
            let fk_constraint: Option<String> = row.get("fk_constraint");

            let foreign_key_info = fk_constraint.map(|constraint_name| ForeignKeyInfo {
                constraint_name,
                referenced_schema: row.get::<Option<String>, _>("ref_schema").unwrap_or_default(),
                referenced_table: row.get::<Option<String>, _>("ref_table").unwrap_or_default(),
                referenced_column: row.get::<Option<String>, _>("ref_column").unwrap_or_default(),
            });
            let enum_values = enum_values_map.get(&udt_name).cloned();

            let col = ColumnInfo {
                name: row.get("col_name"),
                data_type: row.get("data_type"),
                udt_name,
                is_nullable: row.get("is_nullable"),
                is_primary_key: row.get("is_pk"),
                is_unique: row.get("is_unique"),
                is_foreign_key: foreign_key_info.is_some(),
                default_value: row.get("default_value"),
                character_maximum_length: row.get("char_max_len"),
                numeric_precision: row.get("num_precision"),
                numeric_scale: row.get("num_scale"),
                ordinal_position: row.get::<i16, _>("ordinal_position") as i32,
                description: row.get("description"),
                foreign_key_info,
                enum_values,
            };

            let key = (schema_name.clone(), table_name.clone());
            if current_key.as_ref() != Some(&key) {
                tables.push(TableColumnsInfo {
                    schema: schema_name,
                    table: table_name,
                    columns: vec![col],
                });
                current_key = Some(key);
            } else {
                tables.last_mut().unwrap().columns.push(col);
            }
        }

        Ok(tables)
    }
}

/// Quote an identifier to prevent SQL injection
fn quote_identifier(identifier: &str) -> String {
    format!("\"{}\"", identifier.replace('"', "\"\""))
}
