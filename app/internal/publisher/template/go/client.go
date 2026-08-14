package websmith

import (
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type ApiConfig struct {
	URL     string `json:"url"`
	Version string `json:"version"`
	Key     string `json:"public_key"`
	Secret  string `json:"secret"`
	Timeout int    `json:"timeout"`
}

type Config struct {
	API     ApiConfig              `json:"api"`
	Product map[string]interface{} `json:"product"`
}

func LoadConfig(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config: %w", err)
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
	return &cfg, nil
}

type ApiError struct {
	StatusCode int                    `json:"status_code"`
	Message    string                 `json:"message"`
	Data       map[string]interface{} `json:"data,omitempty"`
}

func (e *ApiError) Error() string {
	return fmt.Sprintf("API Error %d: %s", e.StatusCode, e.Message)
}

type Client struct {
	config  *Config
	http    *http.Client
	retries int
}

func NewClient(configPath string) (*Client, error) {
	cfg, err := LoadConfig(configPath)
	if err != nil {
		apiURL := os.Getenv("WEBSMITH_API_URL")
		if apiURL == "" {
			return nil, fmt.Errorf("no config file and no WEBSMITH_API_URL")
		}
		cfg = &Config{
			API: ApiConfig{
				URL:     apiURL,
				Version: "v1",
				Timeout: 30000,
			},
		}
	}
	timeout := time.Duration(cfg.API.Timeout) * time.Millisecond
	return &Client{
		config:  cfg,
		http:    &http.Client{Timeout: timeout},
		retries: 3,
	}, nil
}

func generateTimestamp() string {
	return fmt.Sprintf("%d", time.Now().UnixMilli())
}

func generateNonce() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("%x", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}

func (c *Client) signPayload(payload interface{}, timestamp, nonce string) string {
	var bodyHash string
	if payload != nil {
		b, err := json.Marshal(payload)
		if err == nil {
			h := sha256.Sum256(b)
			bodyHash = hex.EncodeToString(h[:])
		}
	}
	mac := hmac.New(sha256.New, []byte(c.config.API.Secret))
	signStr := fmt.Sprintf("%s%s%s%s", timestamp, nonce, bodyHash, c.config.API.Key)
	mac.Write([]byte(signStr))
	return hex.EncodeToString(mac.Sum(nil))
}

func (c *Client) doRequest(method, endpoint string, data interface{}) (map[string]interface{}, error) {
	baseURL := strings.TrimRight(c.config.API.URL, "/")
	apiVersion := c.config.API.Version
	url := fmt.Sprintf("%s/api/%s/%s", baseURL, apiVersion, endpoint)

	timestamp := generateTimestamp()
	nonce := generateNonce()
	signature := c.signPayload(data, timestamp, nonce)

	var lastErr error
	for attempt := 0; attempt <= c.retries; attempt++ {
		var body io.Reader
		if data != nil {
			b, err := json.Marshal(data)
			if err != nil {
				return nil, err
			}
			body = bytes.NewReader(b)
		}

		req, err := http.NewRequest(method, url, body)
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-API-Key", c.config.API.Key)
		req.Header.Set("X-Timestamp", timestamp)
		req.Header.Set("X-Nonce", nonce)
		req.Header.Set("X-Signature", signature)

		resp, err := c.http.Do(req)
		if err != nil {
			lastErr = err
			if attempt < c.retries {
				time.Sleep(time.Duration(1<<uint(attempt)) * time.Second)
			}
			continue
		}

		respBody, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()
		if readErr != nil {
			lastErr = readErr
			if attempt < c.retries {
				time.Sleep(time.Duration(1<<uint(attempt)) * time.Second)
			}
			continue
		}

		if resp.StatusCode >= 500 {
			lastErr = &ApiError{StatusCode: resp.StatusCode, Message: string(respBody)}
			if attempt < c.retries {
				time.Sleep(time.Duration(1<<uint(attempt)) * time.Second)
			}
			continue
		}

		if len(respBody) == 0 {
			if resp.StatusCode >= 400 {
				return nil, &ApiError{StatusCode: resp.StatusCode, Message: "empty error response"}
			}
			return map[string]interface{}{}, nil
		}

		var result map[string]interface{}
		if err := json.Unmarshal(respBody, &result); err != nil {
			return nil, fmt.Errorf("failed to decode response: %w", err)
		}

		if resp.StatusCode >= 400 {
			msg, _ := result["error"].(string)
			if msg == "" {
				msg = fmt.Sprintf("request failed with status %d", resp.StatusCode)
			}
			return result, &ApiError{
				StatusCode: resp.StatusCode,
				Message:    msg,
				Data:       result,
			}
		}

		return result, nil
	}

	if lastErr != nil {
		return nil, lastErr
	}
	return nil, fmt.Errorf("request failed after %d retries", c.retries+1)
}

func (c *Client) buildPayload(base map[string]interface{}) map[string]interface{} {
	if c.config.Product != nil {
		if pid, ok := c.config.Product["id"].(string); ok && pid != "" {
			base["product_id"] = pid
		}
	}
	return base
}

func (c *Client) ValidateLicense(licenseKey, hardwareID string) (map[string]interface{}, error) {
	return c.doRequest("POST", "license", c.buildPayload(map[string]interface{}{
		"action": "validate", "license_key": licenseKey, "hardware_id": hardwareID,
	}))
}

func (c *Client) ActivateLicense(licenseKey, hardwareID, deviceName string) (map[string]interface{}, error) {
	return c.doRequest("POST", "license", c.buildPayload(map[string]interface{}{
		"action": "activate", "license_key": licenseKey, "hardware_id": hardwareID, "device_name": deviceName,
	}))
}

func (c *Client) DeactivateLicense(licenseKey, hardwareID string) (map[string]interface{}, error) {
	return c.doRequest("POST", "license", c.buildPayload(map[string]interface{}{
		"action": "deactivate", "license_key": licenseKey, "hardware_id": hardwareID,
	}))
}

func (c *Client) RenewLicense(licenseKey string) (map[string]interface{}, error) {
	return c.doRequest("POST", "license", c.buildPayload(map[string]interface{}{
		"action": "renew", "license_key": licenseKey,
	}))
}

func (c *Client) StartTrial(email, customerName string, customerData map[string]interface{}) (map[string]interface{}, error) {
	payload := c.buildPayload(map[string]interface{}{
		"action": "start", "customer_email": email, "customer_name": customerName,
	})
	for k, v := range customerData {
		payload[k] = v
	}
	return c.doRequest("POST", "trial", payload)
}

func (c *Client) CheckTrial(hardwareID string) (map[string]interface{}, error) {
	return c.doRequest("POST", "trial", c.buildPayload(map[string]interface{}{
		"action": "status", "hardware_id": hardwareID,
	}))
}

func (c *Client) ConvertTrial(hardwareID, plan, name, email string) (map[string]interface{}, error) {
	return c.doRequest("POST", "trial", c.buildPayload(map[string]interface{}{
		"action": "convert", "hardware_id": hardwareID, "plan": plan, "customer_name": name, "customer_email": email,
	}))
}

func (c *Client) BindDevice(licenseKey, hardwareID, deviceName string) (map[string]interface{}, error) {
	return c.doRequest("POST", "license", c.buildPayload(map[string]interface{}{
		"action": "bind_device", "license_key": licenseKey, "hardware_id": hardwareID, "device_name": deviceName,
	}))
}

func (c *Client) GetTrialStatus(hardwareID string) (map[string]interface{}, error) {
	return c.doRequest("POST", "trial", c.buildPayload(map[string]interface{}{
		"action": "status", "hardware_id": hardwareID,
	}))
}

func (c *Client) GetProducts() (map[string]interface{}, error) {
	productID, _ := c.config.Product["id"].(string)
	return c.doRequest("POST", "store/products", c.buildPayload(map[string]interface{}{
		"action": "list", "product_id": productID,
	}))
}
