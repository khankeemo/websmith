package wsd

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type ApiError struct {
	StatusCode int                    `json:"status_code"`
	Message    string                 `json:"message"`
	Data       map[string]interface{} `json:"data,omitempty"`
}

func (e *ApiError) Error() string {
	return fmt.Sprintf("API Error %d: %s", e.StatusCode, e.Message)
}

var retryableStatuses = map[int]bool{500: true, 502: true, 503: true, 504: true}

type ApiClient struct {
	config     *Config
	baseURL    string
	apiVersion string
	apiKey     string
	apiSecret  string
	timeout    time.Duration
	retryCount int
	productID  string
	hardware   *HardwareDetector
	cache      *CacheManager
	httpClient *http.Client
}

func NewApiClient(cfg *Config, hw *HardwareDetector, cache *CacheManager) *ApiClient {
	baseURL := cfg.API.URL
	for len(baseURL) > 0 && baseURL[len(baseURL)-1] == '/' {
		baseURL = baseURL[:len(baseURL)-1]
	}
	apiVersion := cfg.API.Version
	if apiVersion == "" {
		apiVersion = "v1"
	}
	timeout := time.Duration(cfg.API.Timeout) * time.Millisecond
	if timeout <= 0 {
		timeout = 30 * time.Second
	}
	retryCount := cfg.API.RetryCount
	if retryCount <= 0 {
		retryCount = 3
	}
	return &ApiClient{
		config:     cfg,
		baseURL:    baseURL,
		apiVersion: apiVersion,
		apiKey:     cfg.API.PublicKey,
		apiSecret:  cfg.API.Secret,
		timeout:    timeout,
		retryCount: retryCount,
		productID:  cfg.Product.ID,
		hardware:   hw,
		cache:      cache,
		httpClient: &http.Client{Timeout: timeout},
	}
}

func (c *ApiClient) getHardwareID() string {
	return c.hardware.GetFingerprint()
}

func (c *ApiClient) signRequest(payload interface{}, method string, path string, query string) map[string]string {
	timestamp := GenerateTimestamp()
	nonce := GenerateNonce()
	signature := SignRequest(payload, c.apiSecret, timestamp, nonce, method, path, query)
	return map[string]string{
		"x-api-key":   c.apiKey,
		"x-timestamp": timestamp,
		"x-nonce":     nonce,
		"x-signature": signature,
	}
}

func (c *ApiClient) request(endpoint string, payload map[string]interface{}, retries ...int) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/api/%s/%s", c.baseURL, c.apiVersion, endpoint)
	maxRetries := c.retryCount
	if len(retries) > 0 {
		maxRetries = retries[0]
	}
	requestPayload := make(map[string]interface{})
	for k, v := range payload {
		requestPayload[k] = v
	}
	if c.productID != "" {
		if _, exists := requestPayload["product_id"]; !exists {
			requestPayload["product_id"] = c.productID
		}
	}
	for attempt := 0; attempt <= maxRetries; attempt++ {
		apiPath := fmt.Sprintf("/api/%s/%s", c.apiVersion, endpoint)
		headers := c.signRequest(requestPayload, "POST", apiPath, "")
		headers["Content-Type"] = "application/json"
		body, err := json.Marshal(requestPayload)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal payload: %w", err)
		}
		resp, err := c.httpClient.Post(url, "application/json", bytes.NewReader(body))
		if err != nil {
			if attempt < maxRetries {
				time.Sleep(time.Duration((attempt+1)*2) * time.Second)
				continue
			}
			return nil, fmt.Errorf("request failed: %w", err)
		}
		respBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		var data map[string]interface{}
		if len(respBody) > 0 {
			json.Unmarshal(respBody, &data)
		}
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			return data, nil
		}
		if resp.StatusCode == 429 {
			if attempt < maxRetries {
				time.Sleep(5 * time.Second)
				continue
			}
			return nil, &ApiError{StatusCode: resp.StatusCode, Message: "Rate limit exceeded", Data: data}
		}
		if retryableStatuses[resp.StatusCode] {
			if attempt < maxRetries {
				time.Sleep(time.Duration((attempt+1)*2) * time.Second)
				continue
			}
			return nil, &ApiError{StatusCode: resp.StatusCode, Message: "Server error", Data: data}
		}
		msg, _ := data["message"].(string)
		if msg == "" {
			msg, _ = data["error"].(string)
		}
		if msg == "" {
			msg = fmt.Sprintf("HTTP %d", resp.StatusCode)
		}
		return nil, &ApiError{StatusCode: resp.StatusCode, Message: msg, Data: data}
	}
	return nil, &ApiError{StatusCode: 500, Message: fmt.Sprintf("Failed after %d retries", maxRetries)}
}

func (c *ApiClient) GetLicenseStatus(hardwareID string) (map[string]interface{}, error) {
	if hardwareID == "" {
		hardwareID = c.getHardwareID()
	}
	url := fmt.Sprintf("%s/internal/backend/license/status?hardware_id=%s", c.baseURL, hardwareID)
	resp, err := c.httpClient.Get(url)
	if err != nil {
		return map[string]interface{}{
			"success": false,
			"status":  "no_license",
			"error":   err.Error(),
		}, nil
	}
	defer resp.Body.Close()
	var data map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return map[string]interface{}{
			"success": false,
			"status":  "no_license",
			"error":   err.Error(),
		}, nil
	}
	return data, nil
}

func (c *ApiClient) ValidateLicense(licenseKey string, hardwareID string) (map[string]interface{}, error) {
	if hardwareID == "" {
		hardwareID = c.getHardwareID()
	}
	payload := map[string]interface{}{
		"action":      "validate",
		"license_key": licenseKey,
		"hardware_id": hardwareID,
	}
	if c.cache != nil && c.cache.IsValid() {
		cached := c.cache.GetLicenseStatus()
		if cached != nil {
			return cached, nil
		}
	}
	result, err := c.request("license", payload)
	if err != nil {
		return nil, err
	}
	if c.cache != nil {
		if success, ok := result["success"].(bool); ok && success {
			if data, ok := result["data"].(map[string]interface{}); ok {
				if valid, ok := data["valid"].(bool); ok && valid {
					c.cache.SetLicenseStatus(result)
				}
			}
		}
	}
	return result, nil
}

func (c *ApiClient) ActivateLicense(licenseKey string, hardwareID string) (map[string]interface{}, error) {
	if hardwareID == "" {
		hardwareID = c.getHardwareID()
	}
	payload := map[string]interface{}{
		"action":      "activate",
		"license_key": licenseKey,
		"hardware_id": hardwareID,
	}
	result, err := c.request("license", payload)
	if err != nil {
		return nil, err
	}
	if c.cache != nil {
		c.cache.InvalidateLicenseStatus()
	}
	return result, nil
}

func (c *ApiClient) DeactivateLicense(licenseKey string, hardwareID string) (map[string]interface{}, error) {
	if hardwareID == "" {
		hardwareID = c.getHardwareID()
	}
	payload := map[string]interface{}{
		"action":      "deactivate",
		"license_key": licenseKey,
		"hardware_id": hardwareID,
	}
	result, err := c.request("license", payload)
	if err != nil {
		return nil, err
	}
	if c.cache != nil {
		c.cache.InvalidateLicenseStatus()
	}
	return result, nil
}

func (c *ApiClient) RenewLicense(licenseKey string, extraDays ...int) (map[string]interface{}, error) {
	payload := map[string]interface{}{
		"action":      "renew",
		"license_key": licenseKey,
	}
	if len(extraDays) > 0 {
		payload["extra_days"] = extraDays[0]
	}
	result, err := c.request("license", payload)
	if err != nil {
		return nil, err
	}
	if c.cache != nil {
		c.cache.InvalidateLicenseStatus()
	}
	return result, nil
}

func (c *ApiClient) StartTrial(email string, customerName string, customerData map[string]interface{}) (map[string]interface{}, error) {
	hardwareID := c.getHardwareID()
	payload := map[string]interface{}{
		"action":         "start",
		"customer_email": email,
		"customer_name":  customerName,
		"hardware_id":    hardwareID,
	}
	for k, v := range customerData {
		payload[k] = v
	}
	return c.request("trial", payload)
}

func (c *ApiClient) GetTrialStatus(hardwareID string) (map[string]interface{}, error) {
	if hardwareID == "" {
		hardwareID = c.getHardwareID()
	}
	return c.request("trial", map[string]interface{}{
		"action":      "status",
		"hardware_id": hardwareID,
	})
}

func (c *ApiClient) ConvertTrial(hardwareID string, plan string, customerName string, customerEmail string) (map[string]interface{}, error) {
	if hardwareID == "" {
		hardwareID = c.getHardwareID()
	}
	payload := map[string]interface{}{
		"action":      "convert",
		"hardware_id": hardwareID,
	}
	if plan != "" {
		payload["plan"] = plan
	}
	if customerName != "" {
		payload["customer_name"] = customerName
	}
	if customerEmail != "" {
		payload["customer_email"] = customerEmail
	}
	result, err := c.request("trial", payload)
	if err != nil {
		return nil, err
	}
	if c.cache != nil {
		c.cache.InvalidateLicenseStatus()
	}
	return result, nil
}

func (c *ApiClient) BindDevice(licenseKey string, hardwareID string, deviceName string) (map[string]interface{}, error) {
	if hardwareID == "" {
		hardwareID = c.getHardwareID()
	}
	payload := map[string]interface{}{
		"action":      "bind",
		"license_key": licenseKey,
		"hardware_id": hardwareID,
	}
	if deviceName != "" {
		payload["device_name"] = deviceName
	}
	return c.request("device", payload)
}

func (c *ApiClient) ReplaceDevice(licenseKey string, newHardwareID string, oldHardwareID string) (map[string]interface{}, error) {
	if newHardwareID == "" {
		newHardwareID = c.getHardwareID()
	}
	if oldHardwareID == "" {
		return nil, fmt.Errorf("old_hardware_id is required for device replacement")
	}
	payload := map[string]interface{}{
		"action":           "replace",
		"license_key":      licenseKey,
		"old_hardware_id":  oldHardwareID,
		"new_hardware_id":  newHardwareID,
	}
	result, err := c.request("device", payload)
	if err != nil {
		return nil, err
	}
	if c.cache != nil {
		c.cache.InvalidateLicenseStatus()
	}
	return result, nil
}

func (c *ApiClient) GetProducts() (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/api/%s/store/products", c.baseURL, c.apiVersion)
	payload := map[string]interface{}{
		"action": "list",
	}
	if c.productID != "" {
		payload["product_id"] = c.productID
	}
	apiPath := fmt.Sprintf("/api/%s/store/products", c.apiVersion)
	headers := c.signRequest(payload, "POST", apiPath, "")
	headers["Content-Type"] = "application/json"
	body, err := json.Marshal(payload)
	if err != nil {
		return map[string]interface{}{"success": false, "products": []interface{}{}}, nil
	}
	resp, err := c.httpClient.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		return map[string]interface{}{"success": false, "products": []interface{}{}}, nil
	}
	defer resp.Body.Close()
	if resp.StatusCode == 200 {
		var data map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&data); err == nil {
			return data, nil
		}
	}
	return map[string]interface{}{"success": false, "products": []interface{}{}}, nil
}

func (c *ApiClient) UpdateCustomer(name string, email string, phone string, hardwareID string) (map[string]interface{}, error) {
	if hardwareID == "" {
		hardwareID = c.getHardwareID()
	}
	payload := map[string]interface{}{
		"action":      "update",
		"name":        name,
		"email":       email,
		"mobile":      phone,
		"hardware_id": hardwareID,
	}
	result, err := c.request("customer/register", payload)
	if err != nil {
		return map[string]interface{}{"success": false, "error": err.Error()}, nil
	}
	if success, ok := result["success"].(bool); ok && success && c.cache != nil {
		c.cache.InvalidateLicenseStatus()
	}
	return result, nil
}
