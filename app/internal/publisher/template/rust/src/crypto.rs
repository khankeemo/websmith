use base64::Engine;
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};

type HmacSha256 = Hmac<Sha256>;

pub fn generate_timestamp() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

pub fn generate_nonce() -> String {
    uuid::Uuid::new_v4().to_string()
}

pub fn sha256_hex(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}

pub fn sha256_hex_bytes(input: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input);
    hex::encode(hasher.finalize())
}

pub fn sign_request(
    payload_json: &str,
    secret: &str,
    timestamp: &str,
    nonce: &str,
    method: &str,
    path: &str,
    query: &str,
) -> Result<String, String> {
    let body_hash = sha256_hex(payload_json);
    let message = format!(
        "{}\n{}\n{}\n{}\n{}\n{}",
        method, path, query, body_hash, timestamp, nonce
    );
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .map_err(|e| format!("HMAC key initialization error: {}", e))?;
    mac.update(message.as_bytes());
    let result = mac.finalize();
    let code_bytes = result.into_bytes();
    Ok(base64::engine::general_purpose::STANDARD.encode(&code_bytes))
}

pub fn sign_payload(
    payload: &serde_json::Value,
    secret: &str,
    timestamp: &str,
    nonce: &str,
    method: &str,
    path: &str,
    query: &str,
) -> Result<String, String> {
    let body_str = serde_json::to_string(payload)
        .map_err(|e| format!("JSON serialization error for signing: {}", e))?;
    sign_request(&body_str, secret, timestamp, nonce, method, path, query)
}

pub fn verify_signature(
    payload_json: &str,
    secret: &str,
    timestamp: &str,
    nonce: &str,
    expected_sig: &str,
    method: &str,
    path: &str,
    query: &str,
) -> bool {
    match sign_request(payload_json, secret, timestamp, nonce, method, path, query) {
        Ok(computed_sig) => {
            use hmac::Mac as HmacTrait;
            let mut mac = match HmacSha256::new_from_slice(secret.as_bytes()) {
                Ok(m) => m,
                Err(_) => return false,
            };
            mac.update(computed_sig.as_bytes());
            mac.verify_slice(expected_sig.as_bytes()).is_ok()
        }
        Err(_) => false,
    }
}

pub fn now_unix_epoch() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
