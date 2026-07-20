import { PublisherContext } from '../index';

export function getGoTemplates(context: PublisherContext): Record<string, string> {
  const sanitized = context.productName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const moduleName = `github.com/websmith/${sanitized}-sdk`;
  return {
    'client.go': `package websmith

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
	URL     string \`json:"url"\`
	Version string \`json:"version"\`
	Key     string \`json:"public_key"\`
	Secret  string \`json:"secret"\`
	Timeout int    \`json:"timeout"\`
}

type Config struct {
	API     ApiConfig              \`json:"api"\`
	Product map[string]interface{} \`json:"product"\`
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
	StatusCode int                    \`json:"status_code"\`
	Message    string                 \`json:"message"\`
	Data       map[string]interface{} \`json:"data,omitempty"\`
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

func (c *Client) ReplaceHardware(licenseKey, oldHardwareID, newHardwareID string) (map[string]interface{}, error) {
	return c.doRequest("POST", "license", c.buildPayload(map[string]interface{}{
		"action": "replace_hardware", "license_key": licenseKey, "old_hardware_id": oldHardwareID, "new_hardware_id": newHardwareID,
	}))
}

func (c *Client) BindDevice(licenseKey, hardwareID, deviceName string) (map[string]interface{}, error) {
	return c.doRequest("POST", "license", c.buildPayload(map[string]interface{}{
		"action": "bind_device", "license_key": licenseKey, "hardware_id": hardwareID, "device_name": deviceName,
	}))
}
`,
    'hardware.go': `package websmith

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

type Fingerprint struct {
	Fingerprint  string   \`json:"fingerprint"\`
	MacAddresses []string \`json:"mac_addresses"\`
	OS           string   \`json:"os"\`
	CPU          string   \`json:"cpu"\`
	Motherboard  string   \`json:"motherboard"\`
	GeneratedAt  string   \`json:"generated_at"\`
}

func GenerateFingerprint() Fingerprint {
	macs := getMACAddresses()
	cpu := getCPUFingerprint()
	mb := getMotherboardSerial()
	parts := []string{
		strings.Join(macs, ":"),
		cpu,
		mb,
		runtime.GOOS,
		runtime.GOARCH,
	}
	combined := strings.Join(parts, "|")
	hash := sha256.Sum256([]byte(combined))
	return Fingerprint{
		Fingerprint:  hex.EncodeToString(hash[:]),
		MacAddresses: macs,
		OS:           runtime.GOOS + "/" + runtime.GOARCH,
		CPU:          cpu,
		Motherboard:  mb,
		GeneratedAt:  time.Now().UTC().Format(time.RFC3339),
	}
}

func getMACAddresses() []string {
	interfaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	var macs []string
	for _, iface := range interfaces {
		if iface.Flags&net.FlagLoopback == 0 && len(iface.HardwareAddr) > 0 {
			macs = append(macs, iface.HardwareAddr.String())
		}
	}
	if len(macs) > 3 {
		macs = macs[:3]
	}
	return macs
}

func getCPUFingerprint() string {
	if runtime.GOOS == "linux" {
		out, err := exec.Command("sh", "-c", "cat /proc/cpuinfo | grep 'model name' | head -1").Output()
		if err == nil {
			if s := strings.TrimSpace(string(out)); s != "" {
				return s
			}
		}
	}
	return fmt.Sprintf("%s_%d", runtime.GOARCH, runtime.NumCPU())
}

func getMotherboardSerial() string {
	switch runtime.GOOS {
	case "linux":
		out, err := exec.Command("sh", "-c",
			"cat /sys/class/dmi/id/board_serial 2>/dev/null || "+
				"cat /sys/class/dmi/id/product_uuid 2>/dev/null || "+
				"cat /sys/class/dmi/id/product_serial 2>/dev/null",
		).Output()
		if err == nil {
			if s := strings.TrimSpace(string(out)); s != "" {
				return s
			}
		}
	case "windows":
		out, err := exec.Command("powershell", "-Command",
			"Get-WmiObject -Class Win32_BaseBoard | Select-Object -ExpandProperty Serial",
		).Output()
		if err == nil {
			if s := strings.TrimSpace(string(out)); s != "" {
				return s
			}
		}
	case "darwin":
		out, err := exec.Command("sh", "-c",
			"system_profiler SPHardwareDataType | awk '/Serial/ {print $4}'",
		).Output()
		if err == nil {
			if s := strings.TrimSpace(string(out)); s != "" {
				return s
			}
		}
	}
	return ""
}
`,
    'cache.go': `package websmith

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type CacheEntry struct {
	Data      interface{} \`json:"data"\`
	ExpiresAt int64       \`json:"expires_at"\`
	CreatedAt int64       \`json:"created_at"\`
}

type CacheManager struct {
	cacheDir string
	ttl      time.Duration
	mu       sync.RWMutex
}

func NewCacheManager(productID string, ttlSeconds int) (*CacheManager, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("cannot determine home directory: %w", err)
	}
	cacheDir := filepath.Join(home, ".websmith", productID)
	if ttlSeconds < 0 {
		ttlSeconds = 0
	}
	return &CacheManager{
		cacheDir: cacheDir,
		ttl:      time.Duration(ttlSeconds) * time.Second,
	}, nil
}

func (cm *CacheManager) GetCacheDir() string {
	return cm.cacheDir
}

func (cm *CacheManager) getFilePath(key string) string {
	return filepath.Join(cm.cacheDir, sanitizeKey(key)+".json")
}

func sanitizeKey(key string) string {
	var sb strings.Builder
	for _, c := range key {
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_' {
			sb.WriteRune(c)
		} else {
			sb.WriteRune('_')
		}
	}
	return sb.String()
}

func (cm *CacheManager) Get(key string) (interface{}, bool) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	data, err := os.ReadFile(cm.getFilePath(key))
	if err != nil {
		return nil, false
	}

	var entry CacheEntry
	if err := json.Unmarshal(data, &entry); err != nil {
		return nil, false
	}

	if entry.ExpiresAt > 0 && time.Now().UnixMilli() > entry.ExpiresAt {
		os.Remove(cm.getFilePath(key))
		return nil, false
	}

	return entry.Data, true
}

func (cm *CacheManager) Set(key string, value interface{}) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	if err := os.MkdirAll(cm.cacheDir, 0700); err != nil {
		return fmt.Errorf("failed to create cache dir: %w", err)
	}

	entry := CacheEntry{
		Data:      value,
		CreatedAt: time.Now().UnixMilli(),
		ExpiresAt: time.Now().Add(cm.ttl).UnixMilli(),
	}

	data, err := json.Marshal(entry)
	if err != nil {
		return fmt.Errorf("failed to marshal cache: %w", err)
	}

	filePath := cm.getFilePath(key)
	tmpPath := filePath + ".tmp." + fmt.Sprintf("%d", time.Now().UnixNano())

	if err := os.WriteFile(tmpPath, data, 0600); err != nil {
		return fmt.Errorf("failed to write cache: %w", err)
	}

	if err := os.Rename(tmpPath, filePath); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("failed to atomically write cache: %w", err)
	}

	return nil
}

func (cm *CacheManager) Clear() error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	entries, err := os.ReadDir(cm.cacheDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("failed to read cache dir: %w", err)
	}

	for _, entry := range entries {
		if !entry.IsDir() && filepath.Ext(entry.Name()) == ".json" {
			if err := os.Remove(filepath.Join(cm.cacheDir, entry.Name())); err != nil {
				return fmt.Errorf("failed to remove cache entry: %w", err)
			}
		}
	}

	return nil
}
`,
    'license.go': `package websmith

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

func (e *LicenseEngine) ReplaceHardware(licenseKey, oldHardwareID, newHardwareID string) (map[string]interface{}, error) {
	return e.client.ReplaceHardware(licenseKey, oldHardwareID, newHardwareID)
}

func (e *LicenseEngine) BindDevice(licenseKey, deviceName string) (map[string]interface{}, error) {
	return e.client.BindDevice(licenseKey, e.fingerprint.Fingerprint, deviceName)
}
`,
    'welcome.go': `package websmith

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

type WelcomeDialog struct {
	ProductName  string
	CompanyName  string
	SupportEmail string
	SupportURL   string
	TrialEnabled bool
	TrialDays    int
}

func NewWelcomeDialog(productName, companyName, supportEmail, supportURL string, trialEnabled bool, trialDays int) *WelcomeDialog {
	return &WelcomeDialog{
		ProductName:  productName,
		CompanyName:  companyName,
		SupportEmail: supportEmail,
		SupportURL:   supportURL,
		TrialEnabled: trialEnabled,
		TrialDays:    trialDays,
	}
}

func (d *WelcomeDialog) Show() {
	reader := bufio.NewReader(os.Stdin)

	fmt.Println(strings.Repeat("-", 50))
	fmt.Printf("Welcome to %s\n", d.ProductName)
	if d.CompanyName != "" {
		fmt.Printf("Powered by %s\n", d.CompanyName)
	}
	fmt.Println(strings.Repeat("-", 50))

	if d.TrialEnabled && d.TrialDays > 0 {
		fmt.Printf("Start your %d-day free trial today!\n", d.TrialDays)
	}

	fmt.Print("Enter your license key (or press Enter to skip): ")
	key, _ := reader.ReadString('\n')
	key = strings.TrimSpace(key)

	if key != "" {
		fmt.Println("License key accepted. Validating...")
	}

	if d.SupportEmail != "" {
		fmt.Printf("Need help? Contact %s\n", d.SupportEmail)
	}
	if d.SupportURL != "" {
		fmt.Printf("Visit %s for more information\n", d.SupportURL)
	}

	fmt.Println(strings.Repeat("-", 50))
}
`,
    'go.mod': `module ${moduleName}

go 1.22
`,
    'README.md': `# ${context.productName} SDK (Go)

## Version
${context.kitVersion}

## Package Structure

\`\`\`
${sanitized}-sdk/
  config/
    api-config.json        # Generated API configuration
  client.go                # HTTP client with HMAC-SHA256 signing
  hardware.go              # Hardware fingerprint generation
  cache.go                 # File-based cache with atomic writes
  license.go               # License engine (orchestrates all operations)
  welcome.go               # Interactive welcome dialog
  go.mod                   # Module definition
  go.sum                   # Dependency checksums (generated)
\`\`\`

## Configuration

The SDK loads configuration from \`config/api-config.json\` or falls back to the
\`WEBSMITH_API_URL\` environment variable. The config file is generated during
publishing and includes your API endpoints, keys, and product settings.

\`\`\`json
{
  "api": {
    "url": "${process.env.WEBSMITH_API_URL || process.env.NEXT_PUBLIC_API_URL || ''}",
    "version": "v1",
    "public_key": "your_api_key",
    "secret": "your_api_secret",
    "timeout": 30000
  },
  "product": {
    "id": "prod_xxx",
    "name": "${context.productName}"
  }
}
\`\`\`

## Initialization

\`\`\`go
package main

import (
	"fmt"
	"log"

	"github.com/websmith/${sanitized}-sdk"
)

func main() {
	engine, err := websmith.NewLicenseEngine("config/api-config.json")
	if err != nil {
		log.Fatalf("Failed to initialize: %v", err)
	}
	if err := engine.Initialize(); err != nil {
		log.Fatalf("Failed to initialize engine: %v", err)
	}
	fmt.Println("SDK initialized successfully")
}
\`\`\`

## Trial Lifecycle

### Start a Trial

\`\`\`go
func startTrial(engine *websmith.LicenseEngine) {
	data := map[string]interface{}{
		"product_id": "prod_xxx",
		"source":     "cli",
	}
	result, err := engine.StartTrial("user@example.com", "John Doe", data)
	if err != nil {
		log.Fatalf("Trial start failed: %v", err)
	}
	fmt.Printf("Trial started: %v\\n", result)
}
\`\`\`

### Check Trial Status

\`\`\`go
func checkTrial(engine *websmith.LicenseEngine) {
	result, err := engine.CheckTrial()
	if err != nil {
		log.Fatalf("Trial check failed: %v", err)
	}
	fmt.Printf("Trial status: %v\\n", result)
}
\`\`\`

### Convert Trial to License

\`\`\`go
func convertTrial(engine *websmith.LicenseEngine) {
	result, err := engine.ConvertTrial("premium", "John Doe", "user@example.com")
	if err != nil {
		log.Fatalf("Trial conversion failed: %v", err)
	}
	fmt.Printf("Trial converted: %v\\n", result)
}
\`\`\`

## License Operations

### Activate a License

\`\`\`go
func activateLicense(engine *websmith.LicenseEngine) {
	result, err := engine.Activate("LICENSE-KEY-HERE", "My Workstation")
	if err != nil {
		log.Fatalf("Activation failed: %v", err)
	}
	fmt.Printf("License activated: %v\\n", result)
	fmt.Printf("Is valid: %v\\n", engine.IsValid())
}
\`\`\`

### Validate a License

\`\`\`go
func validateLicense(engine *websmith.LicenseEngine) {
	result, err := engine.Validate("LICENSE-KEY-HERE")
	if err != nil {
		log.Fatalf("Validation failed: %v", err)
	}
	fmt.Printf("License data: %v\\n", result)
	fmt.Printf("Has license key: %v\\n", engine.HasLicenseKey())
	fmt.Printf("License info: %v\\n", engine.GetLicenseInfo())
}
\`\`\`

### Renew a License

\`\`\`go
func renewLicense(engine *websmith.LicenseEngine) {
	result, err := engine.Renew("LICENSE-KEY-HERE")
	if err != nil {
		log.Fatalf("Renewal failed: %v", err)
	}
	fmt.Printf("License renewed: %v\\n", result)
}
\`\`\`

### Replace Hardware

\`\`\`go
func replaceHardware(engine *websmith.LicenseEngine) {
	result, err := engine.ReplaceHardware("LICENSE-KEY-HERE", "old-fingerprint", "new-fingerprint")
	if err != nil {
		log.Fatalf("Hardware replacement failed: %v", err)
	}
	fmt.Printf("Hardware replaced: %v\\n", result)
}
\`\`\`

### Bind a Device

\`\`\`go
func bindDevice(engine *websmith.LicenseEngine) {
	result, err := engine.BindDevice("LICENSE-KEY-HERE", "Secondary Laptop")
	if err != nil {
		log.Fatalf("Device binding failed: %v", err)
	}
	fmt.Printf("Device bound: %v\\n", result)
}
\`\`\`

### Deactivate a License

\`\`\`go
func deactivateLicense(engine *websmith.LicenseEngine) {
	result, err := engine.Deactivate("LICENSE-KEY-HERE")
	if err != nil {
		log.Fatalf("Deactivation failed: %v", err)
	}
	fmt.Printf("License deactivated: %v\\n", result)
}
\`\`\`

## Welcome Dialog

\`\`\`go
func showWelcome(engine *websmith.LicenseEngine) {
	dialog := websmith.NewWelcomeDialog(
		"${context.productName}",
		"${context.product.company_name || ''}",
		"${context.product.support_email || ''}",
		"${context.product.support_url || ''}",
		${context.product.trial_enabled},
		${context.product.trial_days},
	)
	dialog.Show()
}
\`\`\`

## Complete Example

\`\`\`go
package main

import (
	"fmt"
	"log"
	"os"

	"github.com/websmith/${sanitized}-sdk"
)

var licenseKey = os.Getenv("LICENSE_KEY")

func main() {
	engine, err := websmith.NewLicenseEngine("config/api-config.json")
	if err != nil {
		log.Fatalf("Failed to initialize: %v", err)
	}

	// Show welcome dialog
	dialog := websmith.NewWelcomeDialog(
		"${context.productName}", "", "", "",
		${context.product.trial_enabled}, ${context.product.trial_days},
	)
	dialog.Show()

	// Activate if license key is provided
	if licenseKey != "" {
		result, err := engine.Activate(licenseKey, "primary")
		if err != nil {
			log.Fatalf("Activation failed: %v", err)
		}
		fmt.Printf("Activated: %v\\n", result)
	}

	// Validate
	if engine.HasLicenseKey() {
		_, err := engine.Validate(licenseKey)
		if err != nil {
			log.Printf("Validation error: %v", err)
		}
		fmt.Printf("License valid: %v\\n", engine.IsValid())
		fmt.Printf("License info: %v\\n", engine.GetLicenseInfo())
	}
}
\`\`\`

## API Endpoints

- \`POST /api/v1/license\` — License management (validate, activate, deactivate, renew, replace_hardware, bind_device)
- \`POST /api/v1/trial\` — Trial management (start, status, convert)
- \`POST /api/v1/countries\` — Country codes
- \`POST /api/v1/status\` — API health check

## License

Generated by Websmith License API Center  
Copyright (c) ${new Date().getFullYear()}
`,
  };
}
