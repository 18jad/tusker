use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use argon2::Argon2;
use rand::RngCore;
use serde::{Deserialize, Serialize};

use crate::error::{DbViewerError, Result};

const MAGIC: &[u8; 4] = b"TUSK";
const VERSION: u8 = 1;
const SALT_LEN: usize = 32;
const NONCE_LEN: usize = 12;
const HEADER_LEN: usize = 4 + 1 + SALT_LEN + NONCE_LEN; // 49 bytes

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportPayload {
    pub version: u32,
    pub exported_at: String,
    pub projects: Vec<ExportedProject>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportedProject {
    pub name: String,
    pub color: String,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
    pub ssl: bool,
    pub instant_commit: bool,
    pub read_only: bool,
    pub last_connected: Option<String>,
    pub created_at: String,
}

fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; 32]> {
    let params = argon2::Params::new(65536, 3, 4, Some(32))
        .map_err(|e| DbViewerError::Export(format!("Argon2 params error: {}", e)))?;
    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params);

    let mut key = [0u8; 32];
    argon2
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|e| DbViewerError::Export(format!("Key derivation failed: {}", e)))?;

    Ok(key)
}

pub fn encrypt_and_write(
    projects: Vec<ExportedProject>,
    password: &str,
    file_path: &str,
) -> Result<()> {
    let payload = ExportPayload {
        version: 1,
        exported_at: chrono::Utc::now().to_rfc3339(),
        projects,
    };

    let json = serde_json::to_vec(&payload)?;

    // Generate random salt and nonce
    let mut salt = [0u8; SALT_LEN];
    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::thread_rng().fill_bytes(&mut salt);
    rand::thread_rng().fill_bytes(&mut nonce_bytes);

    // Derive encryption key
    let key = derive_key(password, &salt)?;

    // Encrypt
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| DbViewerError::Export(format!("Cipher init failed: {}", e)))?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, json.as_ref())
        .map_err(|e| DbViewerError::Export(format!("Encryption failed: {}", e)))?;

    // Build file: MAGIC + VERSION + SALT + NONCE + CIPHERTEXT
    let mut file_data = Vec::with_capacity(HEADER_LEN + ciphertext.len());
    file_data.extend_from_slice(MAGIC);
    file_data.push(VERSION);
    file_data.extend_from_slice(&salt);
    file_data.extend_from_slice(&nonce_bytes);
    file_data.extend_from_slice(&ciphertext);

    std::fs::write(file_path, &file_data)
        .map_err(|e| DbViewerError::Export(format!("Failed to write file: {}", e)))?;

    Ok(())
}

pub fn read_and_decrypt(file_path: &str, password: &str) -> Result<ExportPayload> {
    let data = std::fs::read(file_path)
        .map_err(|e| DbViewerError::Export(format!("Failed to read file: {}", e)))?;

    if data.len() < HEADER_LEN {
        return Err(DbViewerError::Export(
            "Invalid file: too short".to_string(),
        ));
    }

    // Validate magic bytes
    if &data[0..4] != MAGIC {
        return Err(DbViewerError::Export(
            "Not a valid Tusker export file".to_string(),
        ));
    }

    // Check version
    let version = data[4];
    if version != VERSION {
        return Err(DbViewerError::Export(format!(
            "Unsupported file version: {}",
            version
        )));
    }

    let salt = &data[5..5 + SALT_LEN];
    let nonce_bytes = &data[5 + SALT_LEN..HEADER_LEN];
    let ciphertext = &data[HEADER_LEN..];

    // Derive key
    let key = derive_key(password, salt)?;

    // Decrypt
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| DbViewerError::Export(format!("Cipher init failed: {}", e)))?;
    let nonce = Nonce::from_slice(nonce_bytes);
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| DbViewerError::Export("Incorrect password or corrupted file".to_string()))?;

    let payload: ExportPayload = serde_json::from_slice(&plaintext)?;

    Ok(payload)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::NamedTempFile;

    fn sample_project() -> ExportedProject {
        ExportedProject {
            name: "Test DB".to_string(),
            color: "blue".to_string(),
            host: "localhost".to_string(),
            port: 5432,
            database: "testdb".to_string(),
            username: "postgres".to_string(),
            password: "secret123".to_string(),
            ssl: false,
            instant_commit: false,
            read_only: false,
            last_connected: Some("2026-01-01T00:00:00Z".to_string()),
            created_at: "2026-01-01T00:00:00Z".to_string(),
        }
    }

    #[test]
    fn test_roundtrip() {
        let tmp = NamedTempFile::new().unwrap();
        let path = tmp.path().to_str().unwrap();
        let password = "testpassword123";

        let projects = vec![sample_project()];
        encrypt_and_write(projects, password, path).unwrap();

        let payload = read_and_decrypt(path, password).unwrap();
        assert_eq!(payload.projects.len(), 1);
        assert_eq!(payload.projects[0].name, "Test DB");
        assert_eq!(payload.projects[0].password, "secret123");
        assert_eq!(payload.version, 1);
    }

    #[test]
    fn test_wrong_password() {
        let tmp = NamedTempFile::new().unwrap();
        let path = tmp.path().to_str().unwrap();

        encrypt_and_write(vec![sample_project()], "correct", path).unwrap();

        let result = read_and_decrypt(path, "wrong");
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("Incorrect password"));
    }

    #[test]
    fn test_invalid_file() {
        let tmp = NamedTempFile::new().unwrap();
        let path = tmp.path().to_str().unwrap();
        fs::write(path, b"not a tusker file").unwrap();

        let result = read_and_decrypt(path, "password");
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("Not a valid Tusker"));
    }

    #[test]
    fn test_truncated_file() {
        let tmp = NamedTempFile::new().unwrap();
        let path = tmp.path().to_str().unwrap();
        fs::write(path, b"TUS").unwrap();

        let result = read_and_decrypt(path, "password");
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("too short"));
    }
}
