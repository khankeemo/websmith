use std::collections::HashMap;
use std::time::Duration;

use crate::crypto;
use crate::{CacheManager, Config, HardwareDetector};

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

pub struct ApiClient {
    config: Config,
    base_url: String,
    api_version: String,
    api_key: String,
    api_secret: String,
    timeout: Duration,
    retry_count: u32,
    product_id: String,
    hardware: Option<HardwareDetector>,
    cache: Option<CacheManager>,
    http_client: reqwest::blocking::Client,
}

impl ApiClient {
    pub fn new(config: Config, hardware: Option<HardwareDetector>, cache: Option<CacheManager>) -> Self {
        let base_url = config.api.url.trim_end_matches('/').to_string();
        let api_version = if config.api.version.is_empty() {
            "v1".to_string()
        } else {
            config.api.version.clone()
        };
        let timeout_secs = if config.api.timeout > 0 {
            config.api.timeout / 1000
        } else {
            30
        };
        let retry_count = if config.api.retry_count > 0 {
            config.api.retry_count
        } else {
            3
        };
        let http_client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(timeout_secs.max(1)))
            .build()
            .expect("Failed to build HTTP client");
        Self {
            api_key: config.api.public_key.clone(),
            api_secret: config.api.secret.clone(),
            base_url,
            api_version,
            timeout: Duration::from_secs(timeout_secs.max(1)),
            retry_count,
            product_id: config.product.id.clone(),
            hardware,
            cache,
            http_client,
            config,
        }
    }

    fn get_hardware_id(&mut self) -> String {
        if let Some(ref mut hw) = self.hardware {
            hw.get_fingerprint()
        } else {
            String::new()
        }
    }

    fn sign_headers(&self, payload: &serde_json::Value, method: &str, path: &str, query: &str) -> Result<HashMap<String, String>, ApiError> {
        let timestamp = crypto::generate_timestamp();
        let nonce = crypto::generate_nonce();
        let body_str = serde_json::to_string(payload)
            .map_err(|e| ApiError::Serialization(e.to_string()))?;
        let signature = crypto::sign_request(&body_str, &self.api_secret, &timestamp, &nonce, method, path, query)
            .map_err(|e| ApiError::Config(e))?;
        let mut headers = HashMap::new();
        headers.insert("x-api-key".to_string(), self.api_key.clone());
        headers.insert("x-timestamp".to_string(), timestamp);
        headers.insert("x-nonce".to_string(), nonce);
        headers.insert("x-signature".to_string(), signature);
        headers.insert("Content-Type".to_string(), "application/json".to_string());
        Ok(headers)
    }

    pub fn request(&mut self, endpoint: &str, mut payload: serde_json::Value) -> Result<serde_json::Value, ApiError> {
        let url = format!("{}/api/{}/{}", self.base_url, self.api_version, endpoint);
        let max_retries = self.retry_count;
        if !self.product_id.is_empty() {
            if let Some(obj) = payload.as_object_mut() {
                obj.entry("product_id".to_string()).or_insert(serde_json::Value::String(self.product_id.clone()));
            }
        }
        for attempt in 0..=max_retries {
            let api_path = format!("/api/{}/{}", self.api_version, endpoint);
            let headers = self.sign_headers(&payload, "POST", &api_path, "")?;
            let body_str = serde_json::to_string(&payload)
                .map_err(|e| ApiError::Serialization(e.to_string()))?;
            let mut req = self.http_client.post(&url)
                .body(body_str);
            for (k, v) in &headers {
                req = req.header(k.as_str(), v.as_str());
            }
            match req.send() {
                Ok(resp) => {
                    let status = resp.status();
                    let data: serde_json::Value = resp.json().unwrap_or(serde_json::Value::Null);
                    if status.is_success() {
                        return Ok(data);
                    }
                    if status.as_u16() == 429 {
                        if attempt < max_retries {
                            std::thread::sleep(Duration::from_secs(5));
                            continue;
                        }
                        return Err(ApiError::RateLimited(
                            data.get("message").and_then(|v| v.as_str()).unwrap_or("Rate limit exceeded").to_string()
                        ));
                    }
                    if status.is_server_error() {
                        if attempt < max_retries {
                            std::thread::sleep(Duration::from_secs((attempt as u64 + 1) * 2));
                            continue;
                        }
                        return Err(ApiError::HttpStatus(status.as_u16(), "Server error".to_string()));
                    }
                    let msg = data.get("message")
                        .or_else(|| data.get("error"))
                        .and_then(|v| v.as_str())
                        .unwrap_or(&format!("HTTP {}", status))
                        .to_string();
                    return Err(ApiError::HttpStatus(status.as_u16(), msg));
                }
                Err(e) => {
                    if e.is_timeout() {
                        if attempt < max_retries {
                            std::thread::sleep(Duration::from_secs((attempt as u64 + 1) * 2));
                            continue;
                        }
                        return Err(ApiError::Timeout(format!("Request timeout after {:?}", self.timeout)));
                    }
                    if e.is_connect() {
                        if attempt < max_retries {
                            std::thread::sleep(Duration::from_secs((attempt as u64 + 1) * 2));
                            continue;
                        }
                        return Err(ApiError::Connection(format!("Connection error: {}", e)));
                    }
                    if attempt < max_retries {
                        std::thread::sleep(Duration::from_secs((attempt as u64 + 1) * 2));
                        continue;
                    }
                    return Err(ApiError::Connection(format!("Request failed: {}", e)));
                }
            }
        }
        Err(ApiError::Timeout(format!("Failed after {} retries", max_retries + 1)))
    }

    pub fn validate_license(&mut self, license_key: &str, hardware_id: &str) -> Result<serde_json::Value, ApiError> {
        let hw_id = if hardware_id.is_empty() { self.get_hardware_id() } else { hardware_id.to_string() };
        if let Some(ref mut cache) = self.cache {
            if cache.is_valid() {
                if let Some(cached) = cache.get_license_status() {
                    return Ok(cached);
                }
            }
        }
        let payload = serde_json::json!({
            "action": "validate",
            "license_key": license_key,
            "hardware_id": hw_id,
        });
        let result = self.request("license", payload)?;
        if let Some(ref mut cache) = self.cache {
            if result.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
                if result.get("data").and_then(|d| d.get("valid")).and_then(|v| v.as_bool()).unwrap_or(false) {
                    cache.set_license_status(result.clone());
                }
            }
        }
        Ok(result)
    }

    pub fn activate_license(&mut self, license_key: &str, hardware_id: &str) -> Result<serde_json::Value, ApiError> {
        let hw_id = if hardware_id.is_empty() { self.get_hardware_id() } else { hardware_id.to_string() };
        let payload = serde_json::json!({
            "action": "activate",
            "license_key": license_key,
            "hardware_id": hw_id,
        });
        let result = self.request("license", payload)?;
        if let Some(ref mut cache) = self.cache {
            cache.invalidate_license_status();
        }
        Ok(result)
    }

    pub fn deactivate_license(&mut self, license_key: &str, hardware_id: &str) -> Result<serde_json::Value, ApiError> {
        let hw_id = if hardware_id.is_empty() { self.get_hardware_id() } else { hardware_id.to_string() };
        let payload = serde_json::json!({
            "action": "deactivate",
            "license_key": license_key,
            "hardware_id": hw_id,
        });
        let result = self.request("license", payload)?;
        if let Some(ref mut cache) = self.cache {
            cache.invalidate_license_status();
        }
        Ok(result)
    }

    pub fn renew_license(&mut self, license_key: &str, extra_days: Option<u32>) -> Result<serde_json::Value, ApiError> {
        let mut payload = serde_json::json!({
            "action": "renew",
            "license_key": license_key,
        });
        if let Some(days) = extra_days {
            payload["extra_days"] = serde_json::json!(days);
        }
        let result = self.request("license", payload)?;
        if let Some(ref mut cache) = self.cache {
            cache.invalidate_license_status();
        }
        Ok(result)
    }

    pub fn start_trial(&mut self, email: &str, customer_name: &str, customer_data: Option<serde_json::Value>) -> Result<serde_json::Value, ApiError> {
        let hardware_id = self.get_hardware_id();
        let mut payload = serde_json::json!({
            "action": "start",
            "customer_email": email,
            "customer_name": customer_name,
            "hardware_id": hardware_id,
        });
        if let Some(data) = customer_data {
            if let Some(obj) = data.as_object() {
                for (k, v) in obj {
                    payload[k] = v.clone();
                }
            }
        }
        self.request("trial", payload)
    }

    pub fn get_trial_status(&mut self, hardware_id: &str) -> Result<serde_json::Value, ApiError> {
        let hw_id = if hardware_id.is_empty() { self.get_hardware_id() } else { hardware_id.to_string() };
        self.request("trial", serde_json::json!({
            "action": "status",
            "hardware_id": hw_id,
        }))
    }

    pub fn convert_trial(&mut self, hardware_id: &str, plan: &str, customer_name: &str, customer_email: &str) -> Result<serde_json::Value, ApiError> {
        let hw_id = if hardware_id.is_empty() { self.get_hardware_id() } else { hardware_id.to_string() };
        let mut payload = serde_json::json!({
            "action": "convert",
            "hardware_id": hw_id,
        });
        if !plan.is_empty() {
            payload["plan"] = serde_json::json!(plan);
        }
        if !customer_name.is_empty() {
            payload["customer_name"] = serde_json::json!(customer_name);
        }
        if !customer_email.is_empty() {
            payload["customer_email"] = serde_json::json!(customer_email);
        }
        let result = self.request("trial", payload)?;
        if let Some(ref mut cache) = self.cache {
            cache.invalidate_license_status();
        }
        Ok(result)
    }

    pub fn bind_device(&mut self, license_key: &str, hardware_id: &str, device_name: &str) -> Result<serde_json::Value, ApiError> {
        let hw_id = if hardware_id.is_empty() { self.get_hardware_id() } else { hardware_id.to_string() };
        let mut payload = serde_json::json!({
            "action": "bind",
            "license_key": license_key,
            "hardware_id": hw_id,
        });
        if !device_name.is_empty() {
            payload["device_name"] = serde_json::json!(device_name);
        }
        self.request("device", payload)
    }

    pub fn replace_device(&mut self, license_key: &str, new_hardware_id: &str, old_hardware_id: &str) -> Result<serde_json::Value, ApiError> {
        let new_hw = if new_hardware_id.is_empty() { self.get_hardware_id() } else { new_hardware_id.to_string() };
        if old_hardware_id.is_empty() {
            return Err(ApiError::Config("old_hardware_id is required for device replacement".to_string()));
        }
        let payload = serde_json::json!({
            "action": "replace",
            "license_key": license_key,
            "old_hardware_id": old_hardware_id,
            "new_hardware_id": new_hw,
        });
        let result = self.request("device", payload)?;
        if let Some(ref mut cache) = self.cache {
            cache.invalidate_license_status();
        }
        Ok(result)
    }

    pub fn get_products(&mut self) -> Result<serde_json::Value, ApiError> {
        let mut payload = serde_json::json!({"action": "list"});
        if !self.product_id.is_empty() {
            payload["product_id"] = serde_json::json!(self.product_id);
        }
        let url = format!("{}/api/{}/store/products", self.base_url, self.api_version);
        let api_path = format!("/api/{}/store/products", self.api_version);
        let headers = self.sign_headers(&payload, "POST", &api_path, "")?;
        let body_str = serde_json::to_string(&payload)
            .map_err(|e| ApiError::Serialization(e.to_string()))?;
        let mut req = self.http_client.post(&url).body(body_str);
        for (k, v) in &headers {
            req = req.header(k.as_str(), v.as_str());
        }
        match req.send() {
            Ok(resp) => {
                if resp.status().is_success() {
                    resp.json().map_err(|e| ApiError::Serialization(e.to_string()))
                } else {
                    Ok(serde_json::json!({"success": false, "products": []}))
                }
            }
            Err(_) => Ok(serde_json::json!({"success": false, "products": []})),
        }
    }

    pub fn update_customer(&mut self, name: &str, email: &str, phone: &str, hardware_id: &str) -> Result<serde_json::Value, ApiError> {
        let hw_id = if hardware_id.is_empty() { self.get_hardware_id() } else { hardware_id.to_string() };
        let payload = serde_json::json!({
            "action": "update",
            "name": name,
            "email": email,
            "mobile": phone,
            "hardware_id": hw_id,
        });
        let result = self.request("customer/register", payload)?;
        if result.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
            if let Some(ref mut cache) = self.cache {
                cache.invalidate_license_status();
            }
        }
        Ok(result)
    }
}
