use serde::{Deserialize, Serialize, Serializer};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DbViewerError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Connection not found: {0}")]
    ConnectionNotFound(String),

    #[error("Connection already exists: {0}")]
    ConnectionAlreadyExists(String),

    #[error("Invalid connection string: {0}")]
    InvalidConnectionString(String),

    #[error("Keyring error: {0}")]
    Keyring(String),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Invalid query: {0}")]
    InvalidQuery(String),

    #[error("Table not found: {0}")]
    TableNotFound(String),

    #[error("Schema not found: {0}")]
    SchemaNotFound(String),

    #[error("Lock error: {0}")]
    Lock(String),

    #[error("Configuration error: {0}")]
    Configuration(String),
}

impl From<keyring::Error> for DbViewerError {
    fn from(err: keyring::Error) -> Self {
        DbViewerError::Keyring(err.to_string())
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub code: String,
    pub message: String,
    pub details: Option<String>,
}

impl From<&DbViewerError> for ErrorResponse {
    fn from(err: &DbViewerError) -> Self {
        let (code, details) = match err {
            DbViewerError::Database(e) => ("DATABASE_ERROR".to_string(), Some(e.to_string())),
            DbViewerError::ConnectionNotFound(_) => ("CONNECTION_NOT_FOUND".to_string(), None),
            DbViewerError::ConnectionAlreadyExists(_) => {
                ("CONNECTION_ALREADY_EXISTS".to_string(), None)
            }
            DbViewerError::InvalidConnectionString(_) => {
                ("INVALID_CONNECTION_STRING".to_string(), None)
            }
            DbViewerError::Keyring(_) => ("KEYRING_ERROR".to_string(), None),
            DbViewerError::Serialization(e) => {
                ("SERIALIZATION_ERROR".to_string(), Some(e.to_string()))
            }
            DbViewerError::InvalidQuery(_) => ("INVALID_QUERY".to_string(), None),
            DbViewerError::TableNotFound(_) => ("TABLE_NOT_FOUND".to_string(), None),
            DbViewerError::SchemaNotFound(_) => ("SCHEMA_NOT_FOUND".to_string(), None),
            DbViewerError::Lock(_) => ("LOCK_ERROR".to_string(), None),
            DbViewerError::Configuration(_) => ("CONFIGURATION_ERROR".to_string(), None),
        };

        ErrorResponse {
            code,
            message: err.to_string(),
            details,
        }
    }
}

impl Serialize for DbViewerError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let response = ErrorResponse::from(self);
        response.serialize(serializer)
    }
}

pub type Result<T> = std::result::Result<T, DbViewerError>;
