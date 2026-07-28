package wsd

import (
	"fmt"
)

type LicenseEngine struct {
	config     *Config
	hardware   *HardwareDetector
	cache      *CacheManager
	client     *ApiClient
	status     *LicenseStatus
	licenseKey string
}

func NewLicenseEngine(configPath string) (*LicenseEngine, error) {
	cfg, err := LoadConfig(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}
	hw := NewHardwareDetector()
	cache := NewCacheManager(cfg)
	client := NewApiClient(cfg, hw, cache)
	return &LicenseEngine{
		config:   cfg,
		hardware: hw,
		cache:    cache,
		client:   client,
	}, nil
}

func (e *LicenseEngine) Initialize() *LicenseStatus {
	if e.cache.IsValid() {
		cached := e.cache.GetLicenseStatus()
		if cached != nil {
			e.status = licenseStatusFromMap(cached)
			if e.status.Status != "trial" && e.status.Valid {
				e.cache.MarkHasEverActivatedPaidLicense()
			}
			return e.status
		}
	}
	hardwareID := e.hardware.GetFingerprint()
	statusResponse, err := e.client.GetLicenseStatus(hardwareID)
	if err == nil {
		if success, ok := statusResponse["success"].(bool); ok && success {
			apiStatus, _ := statusResponse["status"].(string)
			if apiStatus == "licensed" {
				lic, _ := statusResponse["license"].(map[string]interface{})
				plan, _ := statusResponse["plan"].(map[string]interface{})
				devices, _ := statusResponse["devices"].(map[string]interface{})
				daysRemaining, _ := lic["days_remaining"].(float64)
				expiryDate, _ := lic["expiry_date"].(string)
				planName, _ := plan["name"].(string)
				licenseKey, _ := lic["license_key"].(string)
				e.status = &LicenseStatus{
					Valid:         true,
					Status:        "licensed",
					ExpiresAt:     expiryDate,
					DaysRemaining: int(daysRemaining),
					Plan:          planName,
					HardwareID:    hardwareID,
					LicenseKey:    licenseKey,
					Message:       "License active",
				}
				if e.status.Valid {
					e.cache.SetLicenseStatus(e.statusToMap())
					e.cache.MarkHasEverActivatedPaidLicense()
				}
				return e.status
			} else if apiStatus == "trial" {
				lic, _ := statusResponse["license"].(map[string]interface{})
				plan, _ := statusResponse["plan"].(map[string]interface{})
				daysRemaining, _ := lic["days_remaining"].(float64)
				expiryDate, _ := lic["expiry_date"].(string)
				planName, _ := plan["name"].(string)
				if planName == "" {
					planName = "Trial"
				}
				e.status = &LicenseStatus{
					Valid:         true,
					Status:        "trial",
					ExpiresAt:     expiryDate,
					DaysRemaining: int(daysRemaining),
					Plan:          planName,
					HardwareID:    hardwareID,
					Message:       "Trial active",
					TrialActive:   true,
				}
				if e.status.Valid {
					e.cache.SetLicenseStatus(e.statusToMap())
				}
				return e.status
			}
		}
	}
	if e.cache.HasEverActivatedPaidLicense() {
		e.status = &LicenseStatus{
			Valid:      false,
			Status:     "force_reactivation",
			HardwareID: hardwareID,
			LicenseKey: e.licenseKey,
			Message:    "License inactive. Please reactivate.",
		}
		return e.status
	}
	e.status = &LicenseStatus{
		Valid:      false,
		Status:     "unlicensed",
		HardwareID: hardwareID,
		Message:    "No license or trial found",
	}
	return e.status
}

func licenseStatusFromMap(data map[string]interface{}) *LicenseStatus {
	valid, _ := data["valid"].(bool)
	status, _ := data["status"].(string)
	expiresAt, _ := data["expires_at"].(string)
	daysRemaining, _ := data["days_remaining"].(float64)
	plan, _ := data["plan"].(string)
	hardwareID, _ := data["hardware_id"].(string)
	message, _ := data["message"].(string)
	licenseKey, _ := data["license_key"].(string)
	trialActive, _ := data["trial_active"].(bool)
	return &LicenseStatus{
		Valid:         valid,
		Status:        status,
		ExpiresAt:     expiresAt,
		DaysRemaining: int(daysRemaining),
		Plan:          plan,
		HardwareID:    hardwareID,
		Message:       message,
		LicenseKey:    licenseKey,
		TrialActive:   trialActive,
	}
}

func (e *LicenseEngine) statusToMap() map[string]interface{} {
	if e.status == nil {
		return nil
	}
	return map[string]interface{}{
		"valid":          e.status.Valid,
		"status":         e.status.Status,
		"expires_at":     e.status.ExpiresAt,
		"days_remaining": e.status.DaysRemaining,
		"plan":           e.status.Plan,
		"hardware_id":    e.status.HardwareID,
		"message":        e.status.Message,
		"license_key":    e.status.LicenseKey,
		"trial_active":   e.status.TrialActive,
	}
}

func (e *LicenseEngine) GetHardwareID() string {
	return e.hardware.GetFingerprint()
}

func (e *LicenseEngine) GetStatus() *LicenseStatus {
	return e.status
}

func (e *LicenseEngine) GetLicenseKey() string {
	return e.licenseKey
}

func (e *LicenseEngine) HasLicenseKey() bool {
	return e.licenseKey != ""
}

func (e *LicenseEngine) Validate(licenseKey string) (map[string]interface{}, error) {
	key := licenseKey
	if key == "" {
		key = e.licenseKey
	}
	if key == "" {
		return nil, fmt.Errorf("license key unavailable. Please activate first.")
	}
	hardwareID := e.hardware.GetFingerprint()
	result, err := e.client.ValidateLicense(key, hardwareID)
	if err != nil {
		return nil, err
	}
	data, _ := result["data"].(map[string]interface{})
	if data == nil {
		data = result
	}
	if valid, ok := data["valid"].(bool); ok && valid {
		if lk, ok := data["license_key"].(string); ok && lk != "" {
			e.licenseKey = lk
		}
		e.Initialize()
		e.cache.MarkHasEverActivatedPaidLicense()
	}
	return result, nil
}

func (e *LicenseEngine) Activate(licenseKey string) (map[string]interface{}, error) {
	result, err := e.client.ActivateLicense(licenseKey, "")
	if err != nil {
		return nil, err
	}
	if success, ok := result["success"].(bool); ok && success {
		e.licenseKey = licenseKey
		e.Initialize()
		e.cache.MarkHasEverActivatedPaidLicense()
	}
	return result, nil
}

func (e *LicenseEngine) StartTrial(email string, customerName string, customerData map[string]interface{}) (map[string]interface{}, error) {
	result, err := e.client.StartTrial(email, customerName, customerData)
	if err != nil {
		return nil, err
	}
	if success, ok := result["success"].(bool); ok && success {
		e.Initialize()
	}
	return result, nil
}

func (e *LicenseEngine) ConvertTrial(plan string, customerName string, customerEmail string) (map[string]interface{}, error) {
	status := e.Initialize()
	if status == nil || status.Status != "trial" {
		return nil, fmt.Errorf("no active trial to convert")
	}
	hardwareID := e.hardware.GetFingerprint()
	result, err := e.client.ConvertTrial(hardwareID, plan, customerName, customerEmail)
	if err != nil {
		return nil, err
	}
	if success, ok := result["success"].(bool); ok && success {
		if lk, ok := result["license_key"].(string); ok {
			e.licenseKey = lk
		}
		e.Initialize()
		e.cache.MarkHasEverActivatedPaidLicense()
	}
	return result, nil
}

func (e *LicenseEngine) Renew(extraDays ...int) (map[string]interface{}, error) {
	if e.licenseKey == "" {
		return nil, fmt.Errorf("license key unavailable. Please activate first.")
	}
	var result map[string]interface{}
	var err error
	if len(extraDays) > 0 {
		result, err = e.client.RenewLicense(e.licenseKey, extraDays[0])
	} else {
		result, err = e.client.RenewLicense(e.licenseKey)
	}
	if err != nil {
		return nil, err
	}
	if success, ok := result["success"].(bool); ok && success {
		e.Initialize()
		e.cache.MarkHasEverActivatedPaidLicense()
	}
	return result, nil
}

func (e *LicenseEngine) Deactivate(licenseKey string) (map[string]interface{}, error) {
	key := licenseKey
	if key == "" {
		key = e.licenseKey
	}
	if key == "" {
		return nil, fmt.Errorf("license key unavailable. Please provide a key.")
	}
	result, err := e.client.DeactivateLicense(key, "")
	if err != nil {
		return nil, err
	}
	if success, ok := result["success"].(bool); ok && success {
		e.cache.InvalidateLicenseStatus()
		e.status = nil
		if licenseKey == "" {
			e.licenseKey = ""
		}
	}
	return result, nil
}

func (e *LicenseEngine) ReplaceHardware() (map[string]interface{}, error) {
	if e.licenseKey == "" {
		return nil, fmt.Errorf("license key unavailable. Please activate first.")
	}
	newHardwareID := e.hardware.GetFingerprint()
	oldHardwareID := ""
	if e.status != nil && e.status.HardwareID != "" {
		oldHardwareID = e.status.HardwareID
	}
	if oldHardwareID == "" {
		cached := e.cache.GetLicenseStatus()
		if cached != nil {
			if hwID, ok := cached["hardware_id"].(string); ok {
				oldHardwareID = hwID
			}
		}
	}
	if oldHardwareID == "" {
		return nil, fmt.Errorf("current hardware_id unavailable. Cannot replace device.")
	}
	if oldHardwareID == newHardwareID {
		return map[string]interface{}{"success": false, "message": "Old and new hardware IDs are identical."}, nil
	}
	result, err := e.client.ReplaceDevice(e.licenseKey, newHardwareID, oldHardwareID)
	if err != nil {
		return nil, err
	}
	if success, ok := result["success"].(bool); ok && success {
		e.cache.InvalidateLicenseStatus()
		e.status = nil
		e.Initialize()
		e.cache.MarkHasEverActivatedPaidLicense()
	}
	return result, nil
}

func (e *LicenseEngine) BindDevice(licenseKey string, deviceName string) (map[string]interface{}, error) {
	key := licenseKey
	if key == "" {
		key = e.licenseKey
	}
	if key == "" {
		return nil, fmt.Errorf("license key unavailable.")
	}
	result, err := e.client.BindDevice(key, "", deviceName)
	if err != nil {
		return nil, err
	}
	if success, ok := result["success"].(bool); ok && success {
		e.Initialize()
		e.cache.MarkHasEverActivatedPaidLicense()
	}
	return result, nil
}
