use std::collections::HashMap;

use crate::cache::CacheManager;
use crate::client::{ApiClient, ApiError};
use crate::hardware::HardwareDetector;
use crate::Config;

#[derive(Debug, Clone)]
pub struct LicenseStatus {
    pub valid: bool,
    pub status: String,
    pub expires_at: Option<String>,
    pub days_remaining: u32,
    pub plan: Option<String>,
    pub hardware_id: Option<String>,
    pub message: Option<String>,
    pub license_key: Option<String>,
    pub trial_active: bool,
}

impl LicenseStatus {
    pub fn from_map(data: &serde_json::Value) -> Self {
        let status = data.get("status").and_then(|v| v.as_str()).unwrap_or("unlicensed").to_string();
        let valid = data.get("valid").and_then(|v| v.as_bool()).unwrap_or(false);
        Self {
            valid,
            status: status.clone(),
            expires_at: data.get("expires_at").and_then(|v| v.as_str()).map(|s| s.to_string()),
            days_remaining: data.get("days_remaining").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
            plan: data.get("plan").and_then(|v| v.as_str()).map(|s| s.to_string()),
            hardware_id: data.get("hardware_id").and_then(|v| v.as_str()).map(|s| s.to_string()),
            message: data.get("message").and_then(|v| v.as_str()).map(|s| s.to_string()),
            license_key: data.get("license_key").and_then(|v| v.as_str()).map(|s| s.to_string()),
            trial_active: data.get("trial_active").and_then(|v| v.as_bool()).unwrap_or(status == "trial"),
        }
    }

    pub fn to_map(&self) -> serde_json::Value {
        let mut map = serde_json::Map::new();
        map.insert("valid".to_string(), serde_json::json!(self.valid));
        map.insert("status".to_string(), serde_json::json!(self.status));
        if let Some(ref v) = self.expires_at {
            map.insert("expires_at".to_string(), serde_json::json!(v));
        }
        map.insert("days_remaining".to_string(), serde_json::json!(self.days_remaining));
        if let Some(ref v) = self.plan {
            map.insert("plan".to_string(), serde_json::json!(v));
        }
        if let Some(ref v) = self.hardware_id {
            map.insert("hardware_id".to_string(), serde_json::json!(v));
        }
        if let Some(ref v) = self.message {
            map.insert("message".to_string(), serde_json::json!(v));
        }
        if let Some(ref v) = self.license_key {
            map.insert("license_key".to_string(), serde_json::json!(v));
        }
        map.insert("trial_active".to_string(), serde_json::json!(self.trial_active));
        serde_json::Value::Object(map)
    }
}

pub struct LicenseEngine {
    pub config: Config,
    pub client: ApiClient,
    hardware: HardwareDetector,
    cache: CacheManager,
    status: Option<LicenseStatus>,
    pub license_key: Option<String>,
    pub product_name: String,
}

impl LicenseEngine {
    pub fn new(config: Config) -> Self {
        let hw = HardwareDetector::new();
        let cache = CacheManager::new(&config);
        let client = ApiClient::new(config.clone(), Some(HardwareDetector::new()), Some(CacheManager::new(&config)));
        let product_name = config.product.name.clone();
        Self {
            config,
            client,
            hardware: hw,
            cache,
            status: None,
            license_key: None,
            product_name,
        }
    }

    pub fn initialize(&mut self) -> LicenseStatus {
        if self.cache.is_valid() {
            if let Some(cached) = self.cache.get_license_status() {
                let status = LicenseStatus::from_map(&cached);
                if status.status != "trial" && status.valid {
                    self.cache.mark_has_ever_activated_paid_license();
                }
                self.status = Some(status.clone());
                return status;
            }
        }

        let hardware_id = self.hardware.get_fingerprint();
        // Priority 1: Validate active paid license from server
        if let Some(ref key) = self.license_key.clone() {
            match self.client.validate_license(key, &hardware_id) {
                Ok(result) => {
                    let data = result.get("data").unwrap_or(&result).clone();
                    if data.get("valid").and_then(|v| v.as_bool()).unwrap_or(false) {
                        let status_str = data.get("status").and_then(|v| v.as_str()).unwrap_or("active");
                        let days_left = data.get("days_left").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                        let status = LicenseStatus {
                            valid: true,
                            status: status_str.to_string(),
                            expires_at: data.get("expiry_date").and_then(|v| v.as_str()).map(|s| s.to_string()),
                            days_remaining: days_left,
                            plan: data.get("plan").and_then(|v| v.as_str()).map(|s| s.to_string()),
                            hardware_id: Some(hardware_id.clone()),
                            message: Some("License active".to_string()),
                            license_key: Some(key.clone()),
                            trial_active: false,
                        };
                        if status.valid {
                            self.cache.set_license_status(status.to_map());
                            self.cache.mark_has_ever_activated_paid_license();
                        }
                        self.status = Some(status.clone());
                        return status;
                    } else {
                        // Paid license is invalid/inactive - check if user ever had one
                        if self.cache.has_ever_activated_paid_license() {
                            let status = LicenseStatus {
                                valid: false,
                                status: "force_reactivation".to_string(),
                                expires_at: None,
                                days_remaining: 0,
                                plan: None,
                                hardware_id: Some(hardware_id.clone()),
                                message: Some("License inactive. Please reactivate.".to_string()),
                                license_key: Some(key.clone()),
                                trial_active: false,
                            };
                            self.status = Some(status.clone());
                            return status;
                        }
                    }
                }
                Err(_) => {
                    // Server error - check if user ever had a paid license
                    if self.cache.has_ever_activated_paid_license() {
                        let status = LicenseStatus {
                            valid: false,
                            status: "force_reactivation".to_string(),
                            expires_at: None,
                            days_remaining: 0,
                            plan: None,
                            hardware_id: Some(hardware_id.clone()),
                            message: Some("License validation failed. Please reactivate.".to_string()),
                            license_key: self.license_key.clone(),
                            trial_active: false,
                        };
                        self.status = Some(status.clone());
                        return status;
                    }
                }
            }
        } else {
            // No license key but check if user ever had one
            if self.cache.has_ever_activated_paid_license() {
                let status = LicenseStatus {
                    valid: false,
                    status: "force_reactivation".to_string(),
                    expires_at: None,
                    days_remaining: 0,
                    plan: None,
                    hardware_id: Some(hardware_id.clone()),
                    message: Some("License inactive. Please reactivate.".to_string()),
                    license_key: None,
                    trial_active: false,
                };
                self.status = Some(status.clone());
                return status;
            }
        }

        // Priority 2: Check for active trial (only if user never had a paid license)
        if !self.cache.has_ever_activated_paid_license() {
            match self.client.get_trial_status(&hardware_id) {
                Ok(trial_resp) => {
                    if let Some(trial_data) = trial_resp.get("data").and_then(|d| d.as_object()) {
                        if trial_data.get("has_trial").and_then(|v| v.as_bool()).unwrap_or(false) {
                            let status_str = trial_data.get("status").and_then(|v| v.as_str()).unwrap_or("trial");
                            let days_left = trial_data.get("days_left").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                            let status = LicenseStatus {
                                valid: status_str == "active",
                                status: status_str.to_string(),
                                expires_at: trial_data.get("expiry_date").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                days_remaining: days_left,
                                plan: trial_data.get("plan").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                hardware_id: Some(hardware_id.clone()),
                                message: Some(format!("Trial is {}", status_str)),
                                license_key: None,
                                trial_active: true,
                            };
                            if status.valid {
                                self.cache.set_license_status(status.to_map());
                            }
                            self.status = Some(status.clone());
                            return status;
                        }
                    }
                }
                Err(_) => {
                    if let Some(cached) = self.cache.get_license_status() {
                        let status = LicenseStatus::from_map(&cached);
                        self.status = Some(status.clone());
                        return status;
                    }
                }
            }
        }

        let status = LicenseStatus {
            valid: false,
            status: "unlicensed".to_string(),
            expires_at: None,
            days_remaining: 0,
            plan: None,
            hardware_id: Some(hardware_id),
            message: Some("No license or trial found".to_string()),
            license_key: None,
            trial_active: false,
        };
        self.status = Some(status.clone());
        status
    }

    pub fn get_hardware_id(&mut self) -> String {
        self.hardware.get_fingerprint()
    }

    pub fn get_status_cloned(&self) -> Option<LicenseStatus> {
        self.status.clone()
    }

    pub fn has_license_key(&self) -> bool {
        self.license_key.is_some()
    }

    pub fn validate(&mut self, license_key: &str) -> Result<serde_json::Value, ApiError> {
        let key = if license_key.is_empty() {
            self.license_key.as_deref().unwrap_or("")
        } else {
            license_key
        };
        if key.is_empty() {
            return Err(ApiError::Config("License key unavailable. Please activate first.".to_string()));
        }
        let hardware_id = self.hardware.get_fingerprint();
        let result = self.client.validate_license(key, &hardware_id)?;
        let data = result.get("data").unwrap_or(&result).clone();
        if data.get("valid").and_then(|v| v.as_bool()).unwrap_or(false) {
            if let Some(lk) = data.get("license_key").and_then(|v| v.as_str()) {
                self.license_key = Some(lk.to_string());
            }
            self.initialize();
            self.cache.mark_has_ever_activated_paid_license();
        }
        Ok(result)
    }

    pub fn activate(&mut self, license_key: &str) -> Result<serde_json::Value, ApiError> {
        let result = self.client.activate_license(license_key, "")?;
        if result.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
            self.license_key = Some(license_key.to_string());
            self.initialize();
            self.cache.mark_has_ever_activated_paid_license();
        }
        Ok(result)
    }

    pub fn start_trial(&mut self, email: &str, customer_name: &str, customer_data: Option<serde_json::Value>) -> Result<serde_json::Value, ApiError> {
        let result = self.client.start_trial(email, customer_name, customer_data)?;
        if result.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
            self.initialize();
        }
        Ok(result)
    }

    pub fn convert_trial(&mut self, plan: &str, customer_name: &str, customer_email: &str) -> Result<serde_json::Value, ApiError> {
        let status = self.initialize();
        if status.status != "trial" {
            return Err(ApiError::Config("No active trial to convert.".to_string()));
        }
        let hardware_id = self.hardware.get_fingerprint();
        let result = self.client.convert_trial(&hardware_id, plan, customer_name, customer_email)?;
        if result.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
            if let Some(lk) = result.get("license_key").and_then(|v| v.as_str()) {
                self.license_key = Some(lk.to_string());
            }
            self.initialize();
            self.cache.mark_has_ever_activated_paid_license();
        }
        Ok(result)
    }

    pub fn renew(&mut self) -> Result<serde_json::Value, ApiError> {
        let key = self.license_key.as_deref().ok_or_else(|| {
            ApiError::Config("License key unavailable. Please activate first.".to_string())
        })?;
        let result = self.client.renew_license(key, None)?;
        if result.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
            self.initialize();
            self.cache.mark_has_ever_activated_paid_license();
        }
        Ok(result)
    }

    pub fn renew_with_days(&mut self, extra_days: u32) -> Result<serde_json::Value, ApiError> {
        let key = self.license_key.as_deref().ok_or_else(|| {
            ApiError::Config("License key unavailable. Please activate first.".to_string())
        })?;
        let result = self.client.renew_license(key, Some(extra_days))?;
        if result.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
            self.initialize();
            self.cache.mark_has_ever_activated_paid_license();
        }
        Ok(result)
    }

    pub fn deactivate(&mut self, license_key: &str) -> Result<serde_json::Value, ApiError> {
        let key = if license_key.is_empty() {
            self.license_key.as_deref().ok_or_else(|| {
                ApiError::Config("License key unavailable. Please provide a key.".to_string())
            })?
        } else {
            license_key
        };
        let result = self.client.deactivate_license(key, "")?;
        if result.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
            self.cache.invalidate_license_status();
            self.status = None;
            if license_key.is_empty() {
                self.license_key = None;
            }
        }
        Ok(result)
    }

    pub fn replace_hardware(&mut self) -> Result<serde_json::Value, ApiError> {
        let key = self.license_key.as_deref().ok_or_else(|| {
            ApiError::Config("License key unavailable. Please activate first.".to_string())
        })?;
        let new_hardware_id = self.hardware.get_fingerprint();
        let old_hardware_id = self.status.as_ref()
            .and_then(|s| s.hardware_id.clone())
            .or_else(|| {
                self.cache.get_license_status()
                    .and_then(|c| c.get("hardware_id").and_then(|v| v.as_str()).map(|s| s.to_string()))
            })
            .ok_or_else(|| ApiError::Config("Current hardware_id unavailable. Cannot replace device.".to_string()))?;
        if old_hardware_id == new_hardware_id {
            return Ok(serde_json::json!({"success": false, "message": "Old and new hardware IDs are identical."}));
        }
        let result = self.client.replace_device(key, &new_hardware_id, &old_hardware_id)?;
        if result.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
            self.cache.invalidate_license_status();
            self.status = None;
            self.initialize();
            self.cache.mark_has_ever_activated_paid_license();
        }
        Ok(result)
    }

    pub fn bind_device(&mut self, license_key: &str, device_name: &str) -> Result<serde_json::Value, ApiError> {
        let key = if license_key.is_empty() {
            self.license_key.as_deref().ok_or_else(|| {
                ApiError::Config("License key unavailable.".to_string())
            })?
        } else {
            license_key
        };
        let result = self.client.bind_device(key, "", device_name)?;
        if result.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
            self.initialize();
            self.cache.mark_has_ever_activated_paid_license();
        }
        Ok(result)
    }

    pub fn is_onboarding_complete(&mut self) -> bool {
        self.cache.is_onboarding_complete()
    }

    pub fn set_onboarding_complete(&mut self) {
        self.cache.set_onboarding_complete();
    }
}
