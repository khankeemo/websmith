package websmith

import (
	"encoding/json"
	"fmt"
	"time"
)

type LicenseEngine struct {
	client      *Client
	cache       *CacheManager
	fingerprint Fingerprint
	licenseData map[string]interface{}
	configPath  string
}

func NewLicenseEngine(configPath string) (*LicenseEngine, error) {
	client, err := NewClient(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create engine: %w", err)
	}

	cfg, _ := LoadConfig(configPath)
	var productID string
	if cfg != nil && cfg.Product != nil {
		if id, ok := cfg.Product["id"].(string); ok {
			productID = id
		}
	}

	var cache *CacheManager
	if productID != "" {
		cache, err = NewCacheManager(productID, 0)
		if err != nil {
			cache = nil
		}
	}

	return &LicenseEngine{
		client:      client,
		cache:       cache,
		fingerprint: GenerateFingerprint(),
		configPath:  configPath,
	}, nil
}

func (e *LicenseEngine) Initialize() error {
	cfg, err := LoadConfig(e.configPath)
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}
	if e.cache == nil && cfg != nil && cfg.Product != nil {
		if id, ok := cfg.Product["id"].(string); ok && id != "" {
			c, err := NewCacheManager(id, 0)
			if err == nil {
				e.cache = c
			}
		}
	}
	return nil
}

func (e *LicenseEngine) HasLicenseKey() bool {
	if e.licenseData == nil {
		return false
	}
	key, ok := e.licenseData["license_key"].(string)
	return ok && key != ""
}

func (e *LicenseEngine) GetLicenseInfo() map[string]interface{} {
	if e.licenseData == nil {
		return nil
	}
	result := make(map[string]interface{})
	for k, v := range e.licenseData {
		result[k] = v
	}
	return result
}

func (e *LicenseEngine) IsValid() bool {
	if e.licenseData == nil {
		return false
	}
	status, ok := e.licenseData["status"].(string)
	if !ok || status != "active" {
		return false
	}
	if expiresAt, ok := e.licenseData["expires_at"].(string); ok && expiresAt != "" {
		t, err := time.Parse(time.RFC3339, expiresAt)
		if err == nil && t.Before(time.Now()) {
			return false
		}
	}
	return true
}

func (e *LicenseEngine) Validate(licenseKey string) (map[string]interface{}, error) {
	if e.cache != nil {
		cacheKey := "license_" + licenseKey
		if cached, ok := e.cache.Get(cacheKey); ok {
			if data, ok := cached.(map[string]interface{}); ok {
				return data, nil
			}
		}
	}

	result, err := e.client.ValidateLicense(licenseKey, e.fingerprint.Fingerprint)
	if err != nil {
		return nil, err
	}
	if lic, ok := result["license"].(map[string]interface{}); ok {
		e.licenseData = lic
	} else {
		e.licenseData = result
	}

	if e.cache != nil {
		e.cache.Set("license_"+licenseKey, result)
	}

	return result, nil
}

func (e *LicenseEngine) Activate(licenseKey, deviceName string) (map[string]interface{}, error) {
	result, err := e.client.ActivateLicense(licenseKey, e.fingerprint.Fingerprint, deviceName)
	if err != nil {
		return nil, err
	}
	if lic, ok := result["license"].(map[string]interface{}); ok {
		e.licenseData = lic
	} else {
		e.licenseData = result
	}
	if e.cache != nil {
		e.cache.Clear()
	}
	return result, nil
}

func (e *LicenseEngine) Deactivate(licenseKey string) (map[string]interface{}, error) {
	result, err := e.client.DeactivateLicense(licenseKey, e.fingerprint.Fingerprint)
	if err != nil {
		return nil, err
	}
	e.licenseData = nil
	if e.cache != nil {
		e.cache.Clear()
	}
	return result, nil
}

func (e *LicenseEngine) Renew(licenseKey string) (map[string]interface{}, error) {
	result, err := e.client.RenewLicense(licenseKey)
	if err != nil {
		return nil, err
	}
	if lic, ok := result["license"].(map[string]interface{}); ok {
		e.licenseData = lic
	}
	if e.cache != nil {
		e.cache.Clear()
	}
	return result, nil
}

func (e *LicenseEngine) StartTrial(email, customerName string, customerData map[string]interface{}) (map[string]interface{}, error) {
	return e.client.StartTrial(email, customerName, customerData)
}

func (e *LicenseEngine) CheckTrial() (map[string]interface{}, error) {
	return e.client.CheckTrial(e.fingerprint.Fingerprint)
}

func (e *LicenseEngine) ConvertTrial(plan, name, email string) (map[string]interface{}, error) {
	return e.client.ConvertTrial(e.fingerprint.Fingerprint, plan, name, email)
}

func (e *LicenseEngine) BindDevice(licenseKey, deviceName string) (map[string]interface{}, error) {
	return e.client.BindDevice(licenseKey, e.fingerprint.Fingerprint, deviceName)
}
