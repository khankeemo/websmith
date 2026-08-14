pub mod cache;

use std::collections::HashMap;
use std::fs;
use std::time::Duration;

use chrono::{DateTime, Utc};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tokio::time::sleep;

use crate::cache::CacheManager;

type HmacSha256 = Hmac<Sha256>;

const CONFIG_PATH: &str = "config/api-config.json";
const BASE_DELAY_MS: u64 = 1000;

// ── Config ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiConfig {
    #[serde(default)]
    pub api: ApiSettings,
    #[serde(default)]
    pub product: ProductSettings,
    #[serde(default)]
    pub license: LicenseSettings,
    #[serde(default)]
    pub offline: OfflineSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ApiSettings {
    pub url: String,
    pub public_key: String,
    pub secret: String,
    pub timeout: u64,
    pub retry_count: u32,
    pub version: String,
}

impl Default for ApiSettings {
    fn default() -> Self {
        Self {
            url: String::new(),
            public_key: String::new(),
            secret: String::new(),
            timeout: 30000,
            retry_count: 3,
            version: "v1".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ProductSettings {
    pub id: String,
    pub name: String,
}

impl Default for ProductSettings {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct LicenseSettings {
    pub enabled: bool,
    pub hardware_binding: bool,
    pub max_devices: u32,
    pub offline_days: u32,
    pub renewal_reminder_days: u32,
}

impl Default for LicenseSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            hardware_binding: true,
            max_devices: 1,
            offline_days: 0,
            renewal_reminder_days: 7,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct OfflineSettings {
    pub cache_days: u32,
}

impl Default for OfflineSettings {
    fn default() -> Self {
        Self { cache_days: 0 }
    }
}

pub fn load_config() -> Result<ApiConfig, String> {
    let content =
        fs::read_to_string(CONFIG_PATH).map_err(|e| format!("Failed to read config: {}", e))?;
    let config: ApiConfig =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse config: {}", e))?;
    Ok(config)
}

pub fn load_config_from(path: &str) -> Result<ApiConfig, String> {
    let content =
        fs::read_to_string(path).map_err(|e| format!("Failed to read config at {}: {}", path, e))?;
    let config: ApiConfig =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse config: {}", e))?;
    Ok(config)
}

// ── Hardware Fingerprint ──────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Fingerprint {
    pub fingerprint: String,
    pub machine_id: String,
    pub cpu_arch: String,
    pub mac_addresses: Vec<String>,
}

pub fn generate_fingerprint() -> Fingerprint {
    let machine_id = machine_uid::get().unwrap_or_else(|_| "unknown".to_string());
    let cpu_arch = std::env::consts::ARCH.to_string();
    let macs = get_mac_addresses();
    let combined = format!("{}|{}|{:?}", machine_id, cpu_arch, macs);
    let mut hasher = Sha256::new();
    hasher.update(combined.as_bytes());
    let fingerprint = hex::encode(hasher.finalize());
    Fingerprint {
        fingerprint,
        machine_id,
        cpu_arch,
        mac_addresses: macs,
    }
}

pub fn get_hardware_id() -> String {
    generate_fingerprint().fingerprint
}

fn get_mac_addresses() -> Vec<String> {
    #[cfg(target_os = "linux")]
    {
        let mut macs: Vec<String> = fs::read_dir("/sys/class/net")
            .into_iter()
            .flatten()
            .flatten()
            .filter_map(|entry| {
                let addr_path = entry.path().join("address");
                fs::read_to_string(addr_path).ok()
            })
            .map(|s| s.trim().to_string())
            .filter(|a| !a.is_empty() && a != "00:00:00:00:00:00")
            .collect();
        if macs.is_empty() {
            if let Ok(Some(mac)) = mac_address::get_mac_address() {
                macs.push(mac.to_string());
            }
        }
        macs.sort();
        macs.dedup();
        macs
    }
    #[cfg(not(target_os = "linux"))]
    {
        let mut macs = Vec::new();
        if let Ok(Some(mac)) = mac_address::get_mac_address() {
            macs.push(mac.to_string());
        }
        macs
    }
}

// ── API Error ─────────────────────────────────────────────

#[derive(Debug)]
pub enum ApiError {
    HttpStatus(u16, String),
    Timeout(String),
    Connection(String),
    RateLimited(String),
    Serialization(String),
    Config(String),
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ApiError::HttpStatus(code, msg) => write!(f, "HTTP {}: {}", code, msg),
            ApiError::Timeout(msg) => write!(f, "Timeout: {}", msg),
            ApiError::Connection(msg) => write!(f, "Connection: {}", msg),
            ApiError::RateLimited(msg) => write!(f, "Rate limited: {}", msg),
            ApiError::Serialization(msg) => write!(f, "Serialization: {}", msg),
            ApiError::Config(msg) => write!(f, "Config: {}", msg),
        }
    }
}

impl std::error::Error for ApiError {}

// ── API Client ────────────────────────────────────────────

pub struct Client {
    api_key: String,
    api_secret: String,
    api_url: String,
    api_version: String,
    retry_count: u32,
    timeout_secs: u64,
    client: reqwest::Client,
    product_id: String,
    cache: Option<CacheManager>,
}

impl Client {
    pub fn new(config: &ApiConfig) -> Self {
        let api_url = std::env::var("WEBSMITH_API_URL")
            .unwrap_or_else(|_| config.api.url.trim_end_matches('/').to_string());
        let api_version = if config.api.version.is_empty() {
            "v1".to_string()
        } else {
            config.api.version.clone()
        };
        let retry_count = if config.api.retry_count > 0 {
            config.api.retry_count
        } else {
            3
        };
        let timeout_secs = if config.api.timeout > 0 {
            config.api.timeout / 1000
        } else {
            30
        };

        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(timeout_secs))
            .build()
            .expect("Failed to build reqwest Client");

        Self {
            api_key: config.api.public_key.clone(),
            api_secret: config.api.secret.clone(),
            api_url,
            api_version,
            retry_count,
            timeout_secs,
            client: http_client,
            product_id: config.product.id.clone(),
            cache: None,
        }
    }

    pub fn with_cache(mut self, cache: CacheManager) -> Self {
        self.cache = Some(cache);
        self
    }

    // ── HMAC Signing ──────────────────────────────────────

    fn sha256_hash(input: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(input.as_bytes());
        hex::encode(hasher.finalize())
    }

    fn sign(secret: &str, message: &str) -> String {
        let mut mac =
            HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC accepts any key length");
        mac.update(message.as_bytes());
        let result = mac.finalize();
        let code_bytes = result.into_bytes();
        base64::encode(&code_bytes)
    }

    fn build_signing_message(
        method: &str,
        path: &str,
        body_hash: &str,
        timestamp: &str,
        nonce: &str,
    ) -> String {
        format!(
            "{}
{}

{}
{}
{}",
            method, path, body_hash, timestamp, nonce
        )
    }

    // ── Core Request ──────────────────────────────────────

    async fn request_raw(
        &self,
        method: &str,
        endpoint: &str,
        body_value: &serde_json::Value,
    ) -> Result<serde_json::Value, ApiError> {
        let url = format!("{}{}", self.api_url, endpoint);

        let mut payload_obj = body_value.as_object().cloned().unwrap_or_default();
        if !self.product_id.is_empty() {
            payload_obj
                .entry("product_id".to_string())
                .or_insert(serde_json::Value::String(self.product_id.clone()));
        }
        let final_body = serde_json::Value::Object(payload_obj);

        let body_str = final_body.to_string();
        let body_hash = Self::sha256_hash(&body_str);
        let timestamp = Utc::now().to_rfc3339();
        let nonce = uuid::Uuid::new_v4().to_string();
        let api_path = format!("/api/{}{}", self.api_version, endpoint);
        let message =
            Self::build_signing_message(method, &api_path, &body_hash, &timestamp, &nonce);
        let signature = Self::sign(&self.api_secret, &message);

        let mut last_error: Option<String> = None;

        for attempt in 0..=self.retry_count {
            let req_method = reqwest::Method::from_bytes(method.as_bytes())
                .unwrap_or(reqwest::Method::POST);

            let mut req = self.client.request(req_method.clone(), &url);

            if req_method != reqwest::Method::GET && req_method != reqwest::Method::HEAD {
                req = req.json(&final_body);
            }

            req = req
                .header("X-API-KEY", &self.api_key)
                .header("X-TIMESTAMP", &timestamp)
                .header("X-NONCE", &nonce)
                .header("X-SIGNATURE", &signature);

            match req.send().await {
                Ok(resp) => {
                    let status = resp.status();
                    let data: serde_json::Value = resp.json().await.unwrap_or_default();

                    if status.is_success() {
                        return Ok(data);
                    }

                    if status.as_u16() == 429 {
                        if attempt < self.retry_count {
                            sleep(Duration::from_millis(BASE_DELAY_MS * 2u64.pow(attempt)))
                                .await;
                            continue;
                        }
                        return Err(ApiError::RateLimited(
                            data.get("message")
                                .and_then(|v| v.as_str())
                                .unwrap_or("Rate limit exceeded")
                                .to_string(),
                        ));
                    }

                    if status.is_server_error() {
                        if attempt < self.retry_count {
                            sleep(Duration::from_millis(BASE_DELAY_MS * 2u64.pow(attempt)))
                                .await;
                            continue;
                        }
                    }

                    let msg = data
                        .get("message")
                        .or_else(|| data.get("error"))
                        .and_then(|v| v.as_str())
                        .unwrap_or(&format!("HTTP {}", status))
                        .to_string();

                    return Err(ApiError::HttpStatus(status.as_u16(), msg));
                }
                Err(e) => {
                    last_error = Some(e.to_string());
                    if e.is_timeout() {
                        if attempt < self.retry_count {
                            sleep(Duration::from_millis(BASE_DELAY_MS * 2u64.pow(attempt)))
                                .await;
                            continue;
                        }
                        return Err(ApiError::Timeout(e.to_string()));
                    }
                    if e.is_connect() {
                        if attempt < self.retry_count {
                            sleep(Duration::from_millis(BASE_DELAY_MS * 2u64.pow(attempt)))
                                .await;
                            continue;
                        }
                        return Err(ApiError::Connection(e.to_string()));
                    }
                    if attempt < self.retry_count {
                        sleep(Duration::from_millis(BASE_DELAY_MS * 2u64.pow(attempt))).await;
                        continue;
                    }
                }
            }
        }

        Err(ApiError::Timeout(
            last_error.unwrap_or_else(|| "Request failed after all retries".to_string()),
        ))
    }

    async fn request(
        &self,
        method: &str,
        endpoint: &str,
        payload: &HashMap<&str, &str>,
    ) -> Result<serde_json::Value, ApiError> {
        let body_value = serde_json::to_value(payload)
            .map_err(|e| ApiError::Serialization(e.to_string()))?;
        self.request_raw(method, endpoint, &body_value).await
    }

    // ── License Methods ───────────────────────────────────

    pub async fn validate_license(
        &self,
        license_key: &str,
        device_id: &str,
    ) -> Result<serde_json::Value, ApiError> {
        let mut body = HashMap::new();
        body.insert("action", "validate");
        body.insert("license_key", license_key);
        body.insert("hardware_id", device_id);
        self.request("POST", "/api/v1/license", &body).await
    }

    pub async fn activate_license(
        &self,
        license_key: &str,
        device_id: &str,
        device_name: &str,
    ) -> Result<serde_json::Value, ApiError> {
        let mut body = HashMap::new();
        body.insert("action", "activate");
        body.insert("license_key", license_key);
        body.insert("hardware_id", device_id);
        body.insert("device_name", device_name);
        self.request("POST", "/api/v1/license", &body).await
    }

    pub async fn deactivate_license(
        &self,
        license_key: &str,
        device_id: &str,
    ) -> Result<serde_json::Value, ApiError> {
        let mut body = HashMap::new();
        body.insert("action", "deactivate");
        body.insert("license_key", license_key);
        body.insert("hardware_id", device_id);
        self.request("POST", "/api/v1/license", &body).await
    }

    pub async fn renew_license(
        &self,
        license_key: &str,
    ) -> Result<serde_json::Value, ApiError> {
        let mut body = HashMap::new();
        body.insert("action", "renew");
        body.insert("license_key", license_key);
        self.request("POST", "/api/v1/license", &body).await
    }

    pub async fn start_trial(
        &self,
        email: &str,
        customer_name: &str,
        hardware_id: &str,
    ) -> Result<serde_json::Value, ApiError> {
        let mut body = HashMap::new();
        body.insert("action", "start");
        body.insert("customer_email", email);
        body.insert("customer_name", customer_name);
        body.insert("hardware_id", hardware_id);
        self.request("POST", "/api/v1/trial", &body).await
    }

    pub async fn check_trial(
        &self,
        hardware_id: &str,
    ) -> Result<serde_json::Value, ApiError> {
        let mut body = HashMap::new();
        body.insert("action", "status");
        body.insert("hardware_id", hardware_id);
        self.request("POST", "/api/v1/trial", &body).await
    }

    pub async fn convert_trial(
        &self,
        hardware_id: &str,
        plan: &str,
        name: &str,
        email: &str,
    ) -> Result<serde_json::Value, ApiError> {
        let mut body = HashMap::new();
        body.insert("action", "convert");
        body.insert("hardware_id", hardware_id);
        body.insert("plan", plan);
        body.insert("customer_name", name);
        body.insert("customer_email", email);
        self.request("POST", "/api/v1/trial", &body).await
    }

    pub async fn bind_device(
        &self,
        license_key: &str,
        hardware_id: &str,
        device_name: &str,
    ) -> Result<serde_json::Value, ApiError> {
        let mut body = HashMap::new();
        body.insert("action", "bind");
        body.insert("license_key", license_key);
        body.insert("hardware_id", hardware_id);
        body.insert("device_name", device_name);
        self.request("POST", "/api/v1/device", &body).await
    }

    pub async fn health_check(&self) -> Result<serde_json::Value, ApiError> {
        let body = HashMap::new();
        self.request("GET", "/api/v1/status", &body).await
    }
}

// ── LicenseInfo ───────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct LicenseInfo {
    pub valid: bool,
    pub status: String,
    pub expires_at: Option<String>,
    pub license_key: Option<String>,
    pub plan: Option<String>,
    pub message: Option<String>,
}

// ── License Engine ────────────────────────────────────────

pub struct LicenseEngine {
    client: Client,
    fingerprint: Fingerprint,
    license_data: Option<serde_json::Value>,
    license_key: Option<String>,
    cache: Option<CacheManager>,
}

impl LicenseEngine {
    pub fn new(config: &ApiConfig) -> Self {
        let mut client = Client::new(config);
        let fingerprint = generate_fingerprint();
        let cache_days = config.offline.cache_days;
        let cache = CacheManager::new(&config.product.id, (cache_days as u64) * 86400);
        client = client.with_cache(cache.clone());
        Self {
            client,
            fingerprint,
            license_data: None,
            license_key: None,
            cache: Some(cache),
        }
    }

    fn extract_info(&self, data: &serde_json::Value) -> LicenseInfo {
        let status = data
            .get("status")
            .or_else(|| data.get("license").and_then(|v| v.get("status")))
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();
        let valid = status == "active";
        let expires_at = data
            .get("expires_at")
            .or_else(|| data.get("license").and_then(|v| v.get("expires_at")))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let plan = data
            .get("plan")
            .or_else(|| data.get("license").and_then(|v| v.get("plan")))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let message = data
            .get("message")
            .or_else(|| data.get("error"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        LicenseInfo {
            valid,
            status,
            expires_at,
            license_key: self.license_key.clone(),
            plan,
            message,
        }
    }

    fn store_license_data(&mut self, key: &str, data: &serde_json::Value) {
        self.license_key = Some(key.to_string());
        self.license_data = Some(data.clone());
        if let Some(ref cache) = self.cache {
            let _ = cache.set("license_data", &data.to_string());
            if let Some(k) = &self.license_key {
                let _ = cache.set("license_key", k);
            }
        }
    }

    pub async fn initialize(&mut self) -> LicenseInfo {
        if let Some(ref cache) = self.cache {
            if let Some(cached_data) = cache.get("license_data") {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&cached_data) {
                    let info = self.extract_info(&val);
                    if !info.valid {
                        let _ = cache.clear();
                    } else {
                        self.license_data = Some(val.clone());
                        if self.license_key.is_none() {
                            self.license_key = val.get("license_key")
                                .and_then(|k| k.as_str())
                                .map(|s| s.to_string());
                        }
                        return info;
                    }
                } else {
                    let _ = cache.clear();
                }
            }
        }

        match self.license_key.clone() {
            Some(key) => match self
                .client
                .validate_license(&key, &self.fingerprint.fingerprint)
                .await
            {
                Ok(data) => {
                    self.store_license_data(&key, &data);
                    self.extract_info(&data)
                }
                Err(_) => LicenseInfo {
                    valid: false,
                    status: "error".to_string(),
                    expires_at: None,
                    license_key: self.license_key.clone(),
                    plan: None,
                    message: Some("Validation request failed".to_string()),
                },
            },
            None => LicenseInfo {
                valid: false,
                status: "uninitialized".to_string(),
                expires_at: None,
                license_key: None,
                plan: None,
                message: Some(
                    "No license key set. Call activate() or start_trial() first.".to_string(),
                ),
            },
        }
    }

    pub async fn validate(
        &mut self,
        license_key: &str,
        device_id: &str,
    ) -> Result<LicenseInfo, ApiError> {
        let result = self.client.validate_license(license_key, device_id).await?;
        self.store_license_data(license_key, &result);
        Ok(self.extract_info(&result))
    }

    pub async fn activate(
        &mut self,
        license_key: &str,
        device_name: &str,
    ) -> Result<LicenseInfo, ApiError> {
        let result = self
            .client
            .activate_license(license_key, &self.fingerprint.fingerprint, device_name)
            .await?;
        self.store_license_data(license_key, &result);
        Ok(self.extract_info(&result))
    }

    pub async fn deactivate(&self) -> Result<serde_json::Value, ApiError> {
        let key = self
            .license_key
            .as_deref()
            .ok_or_else(|| ApiError::Config("No license key set".to_string()))?;
        let result = self
            .client
            .deactivate_license(key, &self.fingerprint.fingerprint)
            .await?;
        if let Some(ref cache) = self.cache {
            let _ = cache.clear();
        }
        Ok(result)
    }

    pub async fn renew(&self) -> Result<serde_json::Value, ApiError> {
        let key = self
            .license_key
            .as_deref()
            .ok_or_else(|| ApiError::Config("No license key set".to_string()))?;
        let result = self.client.renew_license(key).await?;
        if let Some(ref cache) = self.cache {
            let _ = cache.clear();
        }
        Ok(result)
    }

    pub async fn start_trial(
        &self,
        email: &str,
        customer_name: &str,
    ) -> Result<serde_json::Value, ApiError> {
        self.client
            .start_trial(email, customer_name, &self.fingerprint.fingerprint)
            .await
    }

    pub async fn check_trial(&self) -> Result<serde_json::Value, ApiError> {
        self.client.check_trial(&self.fingerprint.fingerprint).await
    }

    pub async fn convert_trial(
        &self,
        plan: &str,
        name: &str,
        email: &str,
    ) -> Result<serde_json::Value, ApiError> {
        let result = self
            .client
            .convert_trial(&self.fingerprint.fingerprint, plan, name, email)
            .await?;
        if let Some(ref cache) = self.cache {
            let _ = cache.clear();
        }
        Ok(result)
    }

    pub async fn bind_device(
        &self,
        device_name: &str,
    ) -> Result<serde_json::Value, ApiError> {
        let key = self
            .license_key
            .as_deref()
            .ok_or_else(|| ApiError::Config("No license key set".to_string()))?;
        let result = self
            .client
            .bind_device(key, &self.fingerprint.fingerprint, device_name)
            .await?;
        if let Some(ref cache) = self.cache {
            let _ = cache.clear();
        }
        Ok(result)
    }

    pub async fn view_hardware_status(&self) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
        let current_hw = get_hardware_id();
        let key = self.license_key.as_deref().unwrap_or("");
        let status = self.client.validate_license(key, &self.fingerprint.fingerprint).await.map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;
        let registered_hw = status["data"]["hardware_id"].as_str().unwrap_or("").to_string();
        let matched = current_hw == registered_hw;
        let result = serde_json::json!({
            "matched": matched,
            "current_hardware_id": current_hw,
            "registered_hardware_id": registered_hw,
            "message": "Hardware replacement requires administrator approval. Please contact support."
        });
        Ok(result)
    }

    pub fn has_license_key(&self) -> bool {
        self.license_key.is_some()
    }

    pub fn is_valid(&self) -> bool {
        match &self.license_data {
            None => false,
            Some(data) => {
                let status = data.get("status").and_then(|v| v.as_str()).unwrap_or("");
                if status != "active" {
                    return false;
                }
                if let Some(expires_at) = data.get("expires_at").and_then(|v| v.as_str()) {
                    if let Ok(expiry) = DateTime::parse_from_rfc3339(expires_at) {
                        if expiry < Utc::now() {
                            return false;
                        }
                    }
                }
                true
            }
        }
    }

    pub fn get_license_info(&self) -> LicenseInfo {
        match &self.license_data {
            Some(data) => self.extract_info(data),
            None => LicenseInfo {
                valid: false,
                status: "none".to_string(),
                expires_at: None,
                license_key: self.license_key.clone(),
                plan: None,
                message: Some("No license data loaded".to_string()),
            },
        }
    }

    pub fn get_fingerprint(&self) -> &Fingerprint {
        &self.fingerprint
    }

    pub fn get_cache(&self) -> Option<&CacheManager> {
        self.cache.as_ref()
    }
}

