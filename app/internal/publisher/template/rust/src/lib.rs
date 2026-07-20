pub mod activation;
pub mod cache;
pub mod client;
pub mod crypto;
pub mod device_replace;
pub mod hardware;
pub mod license_engine;
pub mod renewal;
pub mod welcome;

use std::collections::HashMap;
use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

pub use cache::CacheManager;
pub use client::{ApiClient, ApiError};
pub use crypto::{generate_nonce, generate_timestamp, sign_request};
pub use hardware::HardwareDetector;
pub use license_engine::{LicenseEngine, LicenseStatus};
pub use activation::ActivationDialog;
pub use device_replace::DeviceReplaceDialog;
pub use renewal::RenewalDialog;
pub use welcome::WelcomeDialog;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiSettings {
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub public_key: String,
    #[serde(default)]
    pub secret: String,
    #[serde(default)]
    pub timeout: u64,
    #[serde(default = "default_retry_count")]
    pub retry_count: u32,
    #[serde(default = "default_api_version")]
    pub version: String,
}

fn default_retry_count() -> u32 { 3 }
fn default_api_version() -> String { "v1".to_string() }

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
    pub version: String,
    pub description: String,
}

impl Default for ProductSettings {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: String::new(),
            version: String::new(),
            description: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct TrialSettings {
    pub enabled: bool,
    pub days: u32,
    pub require_email: bool,
    pub message: String,
}

impl Default for TrialSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            days: 7,
            require_email: true,
            message: String::new(),
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Labels {
    pub activation_title: String,
    pub renew_title: String,
    pub replace_title: String,
    pub welcome_title: String,
    pub activate_btn: String,
    pub renew_btn: String,
    pub replace_btn: String,
    pub cancel_btn: String,
    pub refresh_btn: String,
    pub send_otp_btn: String,
    pub verify_otp_btn: String,
    pub start_trial_btn: String,
    pub open_welcome_btn: String,
    pub activate_license_btn: String,
    pub status_label: String,
    pub product_label: String,
    pub version_label: String,
    pub plan_label: String,
    pub expiry_label: String,
    pub remaining_days_label: String,
    pub hardware_id_label: String,
    pub device_name_label: String,
    pub device_usage_label: String,
    pub runtime_label: String,
    pub sdk_version_label: String,
    pub old_hardware_label: String,
    pub new_hardware_label: String,
    pub customer_info_section: String,
    pub product_details_section: String,
    pub hardware_section: String,
    pub license_key_section: String,
    pub license_info_section: String,
    pub current_license_section: String,
    pub available_plans_section: String,
    pub license_status_section: String,
    pub device_replace_section: String,
    pub device_replace_desc: String,
    pub enter_otp_label: String,
    pub need_license_label: String,
    pub mobile_label: String,
    pub unknown_device: String,
    pub new_device: String,
    pub no_license_text: String,
    pub trial_active_text: String,
    pub licensed_text: String,
    pub unlicensed_status: String,
    pub no_active_text: String,
    pub checking_status: String,
    pub runtime_value: String,
    pub hardware_placeholder: String,
    pub expiry_na: String,
    pub plan_na: String,
}

impl Default for Labels {
    fn default() -> Self {
        Self {
            activation_title: "Activate License".to_string(),
            renew_title: "Renew License".to_string(),
            replace_title: "Replace Device".to_string(),
            welcome_title: "Welcome".to_string(),
            activate_btn: "Activate".to_string(),
            renew_btn: "Renew".to_string(),
            replace_btn: "Replace Device".to_string(),
            cancel_btn: "Cancel".to_string(),
            refresh_btn: "Refresh".to_string(),
            send_otp_btn: "Send OTP".to_string(),
            verify_otp_btn: "Verify OTP".to_string(),
            start_trial_btn: "Start Trial".to_string(),
            open_welcome_btn: "Open Welcome".to_string(),
            activate_license_btn: "Activate License".to_string(),
            status_label: "Status".to_string(),
            product_label: "Product".to_string(),
            version_label: "Version".to_string(),
            plan_label: "Plan".to_string(),
            expiry_label: "Expiry".to_string(),
            remaining_days_label: "Remaining days".to_string(),
            hardware_id_label: "Hardware ID".to_string(),
            device_name_label: "Device Name".to_string(),
            device_usage_label: "Device usage".to_string(),
            runtime_label: "Runtime".to_string(),
            sdk_version_label: "SDK Version".to_string(),
            old_hardware_label: "Old Hardware".to_string(),
            new_hardware_label: "New Hardware".to_string(),
            customer_info_section: "Customer Information".to_string(),
            product_details_section: "Product Details".to_string(),
            hardware_section: "Hardware".to_string(),
            license_key_section: "License Key".to_string(),
            license_info_section: "License Info".to_string(),
            current_license_section: "Current License".to_string(),
            available_plans_section: "Available Plans".to_string(),
            license_status_section: "License Status".to_string(),
            device_replace_section: "Device Replacement".to_string(),
            device_replace_desc: "Move your license from old device to this one.".to_string(),
            enter_otp_label: "Enter OTP".to_string(),
            need_license_label: "Need a license?".to_string(),
            mobile_label: "Mobile Number".to_string(),
            unknown_device: "Unknown".to_string(),
            new_device: "New Device".to_string(),
            no_license_text: "No license".to_string(),
            trial_active_text: "Trial Active".to_string(),
            licensed_text: "Licensed".to_string(),
            unlicensed_status: "Unlicensed".to_string(),
            no_active_text: "No active license or trial".to_string(),
            checking_status: "Checking...".to_string(),
            runtime_value: "${runtime}".to_string(),
            hardware_placeholder: "--".to_string(),
            expiry_na: "N/A".to_string(),
            plan_na: "N/A".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct BrandingColors {
    pub primary: String,
    pub secondary: String,
    pub accent: String,
    pub success: String,
    pub warning: String,
    pub error: String,
    pub info: String,
    pub gray: String,
    pub bg_page: String,
    pub bg_card: String,
    pub bg_button: String,
    pub text_primary: String,
    pub text_secondary: String,
    pub text_muted: String,
    pub text_dark: String,
}

impl Default for BrandingColors {
    fn default() -> Self {
        Self {
            primary: "#6366f1".to_string(),
            secondary: "#4f46e5".to_string(),
            accent: "#10b981".to_string(),
            success: "#16a34a".to_string(),
            warning: "#f59e0b".to_string(),
            error: "#dc2626".to_string(),
            info: "#10b981".to_string(),
            gray: "#6b7280".to_string(),
            bg_page: "#f8f9fa".to_string(),
            bg_card: "#ffffff".to_string(),
            bg_button: "#e5e7eb".to_string(),
            text_primary: "#333333".to_string(),
            text_secondary: "#555555".to_string(),
            text_muted: "#888888".to_string(),
            text_dark: "#666666".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Branding {
    pub company_name: String,
    pub logo_url: String,
    pub primary_color: String,
    pub secondary_color: String,
    pub accent_color: String,
    pub support_email: String,
    pub support_url: String,
    pub labels: Labels,
    pub colors: BrandingColors,
}

impl Default for Branding {
    fn default() -> Self {
        Self {
            company_name: String::new(),
            logo_url: String::new(),
            primary_color: "#6366f1".to_string(),
            secondary_color: "#4f46e5".to_string(),
            accent_color: "#10b981".to_string(),
            support_email: "support@websmithdigital.com".to_string(),
            support_url: String::new(),
            labels: Labels::default(),
            colors: BrandingColors::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareFingerprint {
    #[serde(default = "default_true")]
    pub include_cpu: bool,
    #[serde(default = "default_true")]
    pub include_motherboard: bool,
    #[serde(default = "default_true")]
    pub include_mac: bool,
    #[serde(default = "default_true")]
    pub include_os: bool,
    #[serde(default = "default_sha256")]
    pub hash_algorithm: String,
}

fn default_true() -> bool { true }
fn default_sha256() -> String { "sha256".to_string() }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareReplacement {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub require_approval: bool,
    #[serde(default = "default_two")]
    pub max_replacements_per_year: u32,
}

fn default_two() -> u32 { 2 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareSettings {
    #[serde(default)]
    pub fingerprint: HardwareFingerprint,
    #[serde(default)]
    pub replacement: HardwareReplacement,
}

impl Default for HardwareFingerprint {
    fn default() -> Self {
        Self {
            include_cpu: true,
            include_motherboard: true,
            include_mac: true,
            include_os: true,
            hash_algorithm: "sha256".to_string(),
        }
    }
}

impl Default for HardwareReplacement {
    fn default() -> Self {
        Self {
            enabled: true,
            require_approval: false,
            max_replacements_per_year: 2,
        }
    }
}

impl Default for HardwareSettings {
    fn default() -> Self {
        Self {
            fingerprint: HardwareFingerprint::default(),
            replacement: HardwareReplacement::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecuritySettings {
    #[serde(default = "default_hmac_algo")]
    pub hmac_algorithm: String,
    #[serde(default = "default_ts_window")]
    pub timestamp_window: u32,
    #[serde(default = "default_true")]
    pub require_nonce: bool,
    #[serde(default)]
    pub rate_limit: RateLimitSettings,
}

fn default_hmac_algo() -> String { "SHA256".to_string() }
fn default_ts_window() -> u32 { 300 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitSettings {
    #[serde(default = "default_rpm")]
    pub requests_per_minute: u32,
    #[serde(default = "default_rph")]
    pub requests_per_hour: u32,
}

fn default_rpm() -> u32 { 100 }
fn default_rph() -> u32 { 1000 }

impl Default for RateLimitSettings {
    fn default() -> Self {
        Self {
            requests_per_minute: 100,
            requests_per_hour: 1000,
        }
    }
}

impl Default for SecuritySettings {
    fn default() -> Self {
        Self {
            hmac_algorithm: "SHA256".to_string(),
            timestamp_window: 300,
            require_nonce: true,
            rate_limit: RateLimitSettings::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DialogConfig {
    #[serde(default = "default_true")]
    pub trial: bool,
    #[serde(default = "default_true")]
    pub activation: bool,
    #[serde(default = "default_true")]
    pub renewal: bool,
    #[serde(default = "default_true")]
    pub expired: bool,
    #[serde(default = "default_true")]
    pub offline: bool,
    #[serde(default = "default_true")]
    pub hardware_change: bool,
}

impl Default for DialogConfig {
    fn default() -> Self {
        Self {
            trial: true,
            activation: true,
            renewal: true,
            expired: true,
            offline: true,
            hardware_change: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UIConfig {
    #[serde(default = "default_auto")]
    pub theme: String,
    #[serde(default = "default_en")]
    pub language: String,
    #[serde(default = "default_center")]
    pub position: String,
    #[serde(default = "default_true")]
    pub modal: bool,
    #[serde(default = "default_true")]
    pub animations: bool,
    #[serde(default)]
    pub dialogs: DialogConfig,
}

fn default_auto() -> String { "auto".to_string() }
fn default_en() -> String { "en".to_string() }
fn default_center() -> String { "center".to_string() }

impl Default for UIConfig {
    fn default() -> Self {
        Self {
            theme: "auto".to_string(),
            language: "en".to_string(),
            position: "center".to_string(),
            modal: true,
            animations: true,
            dialogs: DialogConfig::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeaturesConfig {
    #[serde(default = "default_true")]
    pub trial: bool,
    #[serde(default = "default_true")]
    pub license: bool,
    #[serde(default = "default_true")]
    pub hardware_binding: bool,
    #[serde(default = "default_true")]
    pub offline_mode: bool,
    #[serde(default = "default_true")]
    pub renewals: bool,
    #[serde(default = "default_true")]
    pub analytics: bool,
    #[serde(default = "default_true")]
    pub audit_logs: bool,
}

impl Default for FeaturesConfig {
    fn default() -> Self {
        Self {
            trial: true,
            license: true,
            hardware_binding: true,
            offline_mode: true,
            renewals: true,
            analytics: true,
            audit_logs: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    #[serde(default)]
    pub api: ApiSettings,
    #[serde(default)]
    pub product: ProductSettings,
    #[serde(default)]
    pub trial: TrialSettings,
    #[serde(default)]
    pub license: LicenseSettings,
    #[serde(default)]
    pub hardware: HardwareSettings,
    #[serde(default)]
    pub offline: OfflineSettings,
    #[serde(default)]
    pub security: SecuritySettings,
    #[serde(default)]
    pub branding: Branding,
    #[serde(default)]
    pub ui: UIConfig,
    #[serde(default)]
    pub features: FeaturesConfig,
}

impl Config {
    pub fn load(path: &str) -> Result<Self, String> {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Failed to read config at {}: {}", path, e))?;
        let mut cfg: Config = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse config: {}", e))?;
        if cfg.api.url.is_empty() {
            cfg.api.url = std::env::var("WEBSMITH_API_URL").unwrap_or_default();
        }
        if cfg.api.version.is_empty() {
            cfg.api.version = "v1".to_string();
        }
        if cfg.api.timeout == 0 {
            cfg.api.timeout = 30000;
        }
        if cfg.api.retry_count == 0 {
            cfg.api.retry_count = 3;
        }
        Ok(cfg)
    }

    pub fn load_default() -> Result<Self, String> {
        let paths = vec!["config/api-config.json", "api-config.json"];
        for path in &paths {
            if Path::new(path).exists() {
                return Self::load(path);
            }
        }
        if let Ok(url) = std::env::var("WEBSMITH_API_URL") {
            return Ok(Config {
                api: ApiSettings {
                    url,
                    ..Default::default()
                },
                ..Default::default()
            });
        }
        Err("No config file found and WEBSMITH_API_URL not set".to_string())
    }
}

pub fn generate_timestamp_iso() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}
