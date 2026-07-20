package wsd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

type ApiSettings struct {
	URL        string `json:"url"`
	Version    string `json:"version"`
	PublicKey  string `json:"public_key"`
	Secret     string `json:"secret"`
	Timeout    int    `json:"timeout"`
	RetryCount int    `json:"retry_count"`
}

type ProductSettings struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Version     string `json:"version"`
	Description string `json:"description"`
}

type TrialSettings struct {
	Enabled       bool   `json:"enabled"`
	Days          int    `json:"days"`
	RequireEmail  bool   `json:"require_email"`
	RequireCompany bool  `json:"require_company"`
	AutoConvert   bool   `json:"auto_convert"`
	Message       string `json:"message"`
}

type LicenseSettings struct {
	Enabled           bool `json:"enabled"`
	HardwareBinding   bool `json:"hardware_binding"`
	MaxDevices        int  `json:"max_devices"`
	OfflineDays       int  `json:"offline_days"`
	RenewalReminder   int  `json:"renewal_reminder_days"`
}

type Colors struct {
	Primary       string `json:"primary"`
	Secondary     string `json:"secondary"`
	Accent        string `json:"accent"`
	Success       string `json:"success"`
	Warning       string `json:"warning"`
	Error         string `json:"error"`
	Info          string `json:"info"`
	Gray          string `json:"gray"`
	BgPage        string `json:"bg_page"`
	BgCard        string `json:"bg_card"`
	BgButton      string `json:"bg_button"`
	TextPrimary   string `json:"text_primary"`
	TextSecondary string `json:"text_secondary"`
	TextMuted     string `json:"text_muted"`
	TextDark      string `json:"text_dark"`
}

type Labels struct {
	ActivationTitle       string `json:"activation_title"`
	RenewTitle            string `json:"renew_title"`
	ReplaceTitle          string `json:"replace_title"`
	WelcomeTitle          string `json:"welcome_title"`
	ActivateBtn           string `json:"activate_btn"`
	RenewBtn              string `json:"renew_btn"`
	ReplaceBtn            string `json:"replace_btn"`
	CancelBtn             string `json:"cancel_btn"`
	RefreshBtn            string `json:"refresh_btn"`
	SendOtpBtn            string `json:"send_otp_btn"`
	VerifyOtpBtn          string `json:"verify_otp_btn"`
	StartTrialBtn         string `json:"start_trial_btn"`
	OpenWelcomeBtn        string `json:"open_welcome_btn"`
	ActivateLicenseBtn    string `json:"activate_license_btn"`
	StatusLabel           string `json:"status_label"`
	ProductLabel          string `json:"product_label"`
	VersionLabel          string `json:"version_label"`
	PlanLabel             string `json:"plan_label"`
	ExpiryLabel           string `json:"expiry_label"`
	RemainingDaysLabel    string `json:"remaining_days_label"`
	HardwareIDLabel       string `json:"hardware_id_label"`
	DeviceNameLabel       string `json:"device_name_label"`
	DeviceUsageLabel      string `json:"device_usage_label"`
	RuntimeLabel          string `json:"runtime_label"`
	SdkVersionLabel       string `json:"sdk_version_label"`
	OldHardwareLabel      string `json:"old_hardware_label"`
	NewHardwareLabel      string `json:"new_hardware_label"`
	CustomerInfoSection   string `json:"customer_info_section"`
	ProductDetailsSection string `json:"product_details_section"`
	HardwareSection       string `json:"hardware_section"`
	LicenseKeySection     string `json:"license_key_section"`
	LicenseInfoSection    string `json:"license_info_section"`
	CurrentLicenseSection string `json:"current_license_section"`
	AvailablePlansSection string `json:"available_plans_section"`
	LicenseStatusSection  string `json:"license_status_section"`
	DeviceReplaceSection  string `json:"device_replace_section"`
	DeviceReplaceDesc     string `json:"device_replace_desc"`
	EnterOtpLabel         string `json:"enter_otp_label"`
	NeedLicenseLabel      string `json:"need_license_label"`
	MobileLabel           string `json:"mobile_label"`
	UnknownDevice         string `json:"unknown_device"`
	NewDevice             string `json:"new_device"`
	NoLicenseText         string `json:"no_license_text"`
	TrialActiveText       string `json:"trial_active_text"`
	LicensedText          string `json:"licensed_text"`
	UnlicensedStatus      string `json:"unlicensed_status"`
	NoActiveText          string `json:"no_active_text"`
	CheckingStatus        string `json:"checking_status"`
	RuntimeValue          string `json:"runtime_value"`
	HardwarePlaceholder   string `json:"hardware_placeholder"`
	ExpiryNa              string `json:"expiry_na"`
	PlanNa                string `json:"plan_na"`
}

type Branding struct {
	CompanyName   string `json:"company_name"`
	LogoURL       string `json:"logo_url"`
	PrimaryColor  string `json:"primary_color"`
	SecondaryColor string `json:"secondary_color"`
	AccentColor   string `json:"accent_color"`
	SupportEmail  string `json:"support_email"`
	SupportURL    string `json:"support_url"`
	Labels        Labels  `json:"labels"`
	Colors        Colors  `json:"colors"`
}

type HardwareFingerprint struct {
	IncludeCPU       bool `json:"include_cpu"`
	IncludeMotherboard bool `json:"include_motherboard"`
	IncludeMAC       bool `json:"include_mac"`
	IncludeOS        bool `json:"include_os"`
	HashAlgorithm    string `json:"hash_algorithm"`
}

type HardwareReplacement struct {
	Enabled                bool `json:"enabled"`
	RequireApproval        bool `json:"require_approval"`
	MaxReplacementsPerYear int  `json:"max_replacements_per_year"`
}

type HardwareSettings struct {
	Fingerprint  HardwareFingerprint  `json:"fingerprint"`
	Replacement HardwareReplacement `json:"replacement"`
}

type SecuritySettings struct {
	HMACAlgorithm  string `json:"hmac_algorithm"`
	TimestampWindow int   `json:"timestamp_window"`
	RequireNonce   bool   `json:"require_nonce"`
	RateLimit      RateLimitSettings `json:"rate_limit"`
}

type RateLimitSettings struct {
	RequestsPerMinute int `json:"requests_per_minute"`
	RequestsPerHour   int `json:"requests_per_hour"`
}

type OfflineSettings struct {
	Enabled             bool   `json:"enabled"`
	CacheDays           int    `json:"cache_days"`
	Encryption          string `json:"encryption"`
	ValidateOnReconnect bool   `json:"validate_on_reconnect"`
}

type UIConfig struct {
	Theme     string       `json:"theme"`
	Language  string       `json:"language"`
	Position  string       `json:"position"`
	Modal     bool         `json:"modal"`
	Animations bool        `json:"animations"`
	Dialogs   DialogConfig `json:"dialogs"`
}

type DialogConfig struct {
	Trial          bool `json:"trial"`
	Activation     bool `json:"activation"`
	Renewal        bool `json:"renewal"`
	Expired        bool `json:"expired"`
	Offline        bool `json:"offline"`
	HardwareChange bool `json:"hardware_change"`
}

type FeaturesConfig struct {
	Trial          bool `json:"trial"`
	License        bool `json:"license"`
	HardwareBinding bool `json:"hardware_binding"`
	OfflineMode    bool `json:"offline_mode"`
	Renewals       bool `json:"renewals"`
	Analytics      bool `json:"analytics"`
	AuditLogs      bool `json:"audit_logs"`
}

type Config struct {
	Product  ProductSettings  `json:"product"`
	API      ApiSettings      `json:"api"`
	Trial    TrialSettings    `json:"trial"`
	License  LicenseSettings  `json:"license"`
	Hardware HardwareSettings `json:"hardware"`
	Offline  OfflineSettings  `json:"offline"`
	Security SecuritySettings `json:"security"`
	Branding Branding         `json:"branding"`
	UI       UIConfig         `json:"ui"`
	Features FeaturesConfig   `json:"features"`
}

func LoadConfig(configPath string) (*Config, error) {
	data, err := os.ReadFile(configPath)
	if err != nil {
		altPath := filepath.Join("config", "api-config.json")
		data, err = os.ReadFile(altPath)
		if err != nil {
			return nil, fmt.Errorf("config not found at %s or %s", configPath, altPath)
		}
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}
	if cfg.API.URL == "" {
		cfg.API.URL = os.Getenv("WEBSMITH_API_URL")
	}
	if cfg.API.Version == "" {
		cfg.API.Version = "v1"
	}
	if cfg.API.Timeout <= 0 {
		cfg.API.Timeout = 30000
	}
	if cfg.API.RetryCount <= 0 {
		cfg.API.RetryCount = 3
	}
	if cfg.Offline.CacheDays < 0 {
		cfg.Offline.CacheDays = 0
	}
	if cfg.Branding.PrimaryColor == "" {
		cfg.Branding.PrimaryColor = "#6366f1"
	}
	if cfg.Branding.SecondaryColor == "" {
		cfg.Branding.SecondaryColor = "#4f46e5"
	}
	if cfg.Branding.AccentColor == "" {
		cfg.Branding.AccentColor = "#10b981"
	}
	if cfg.Branding.SupportEmail == "" {
		cfg.Branding.SupportEmail = "support@websmithdigital.com"
	}
	if cfg.Branding.Colors.Primary == "" {
		cfg.Branding.Colors.Primary = cfg.Branding.PrimaryColor
	}
	if cfg.Branding.Colors.Secondary == "" {
		cfg.Branding.Colors.Secondary = cfg.Branding.SecondaryColor
	}
	if cfg.Branding.Colors.Accent == "" {
		cfg.Branding.Colors.Accent = cfg.Branding.AccentColor
	}
	if cfg.Branding.Colors.Success == "" {
		cfg.Branding.Colors.Success = "#16a34a"
	}
	if cfg.Branding.Colors.Warning == "" {
		cfg.Branding.Colors.Warning = "#f59e0b"
	}
	if cfg.Branding.Colors.Error == "" {
		cfg.Branding.Colors.Error = "#dc2626"
	}
	if cfg.Branding.Colors.Info == "" {
		cfg.Branding.Colors.Info = "#10b981"
	}
	if cfg.Branding.Colors.TextPrimary == "" {
		cfg.Branding.Colors.TextPrimary = "#333333"
	}
	if cfg.Branding.Colors.TextSecondary == "" {
		cfg.Branding.Colors.TextSecondary = "#555555"
	}
	if cfg.Branding.Colors.BgPage == "" {
		cfg.Branding.Colors.BgPage = "#f8f9fa"
	}
	if cfg.Branding.Colors.BgCard == "" {
		cfg.Branding.Colors.BgCard = "#ffffff"
	}
	if cfg.Branding.Labels.RuntimeValue == "" {
		cfg.Branding.Labels.RuntimeValue = "Go"
	}
	return &cfg, nil
}

type LicenseStatus struct {
	Valid         bool   `json:"valid"`
	Status        string `json:"status"`
	ExpiresAt     string `json:"expires_at,omitempty"`
	DaysRemaining int    `json:"days_remaining,omitempty"`
	Plan          string `json:"plan,omitempty"`
	HardwareID    string `json:"hardware_id,omitempty"`
	Message       string `json:"message,omitempty"`
	LicenseKey    string `json:"license_key,omitempty"`
	TrialActive   bool   `json:"trial_active,omitempty"`
}
