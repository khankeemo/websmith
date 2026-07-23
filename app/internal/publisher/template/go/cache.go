package wsd

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
	Value    interface{} `json:"value"`
	CachedAt float64     `json:"cached_at"`
}

type CacheManager struct {
	config     *Config
	productID  string
	cacheDir   string
	cacheFile  string
	tmpFile    string
	corruptFile string
	ttlDays    int
	mu         sync.RWMutex
	cache      map[string]CacheEntry
}

func NewCacheManager(cfg *Config) *CacheManager {
	productID := cfg.Product.ID
	if productID == "" {
		productID = "unknown"
	}
	safeName := sanitizeProductID(productID)
	home, err := os.UserHomeDir()
	if err != nil {
		home = "."
	}
	cacheDir := filepath.Join(home, ".websmith", safeName)
	ttlDays := cfg.Offline.CacheDays
	if ttlDays < 0 {
		ttlDays = 0
	}
	return &CacheManager{
		config:      cfg,
		productID:   productID,
		cacheDir:    cacheDir,
		cacheFile:   filepath.Join(cacheDir, "cache.json"),
		tmpFile:     filepath.Join(cacheDir, "cache.tmp"),
		corruptFile: filepath.Join(cacheDir, "cache.corrupt"),
		ttlDays:     ttlDays,
		cache:       nil,
	}
}

func sanitizeProductID(id string) string {
	var sb strings.Builder
	for _, c := range id {
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_' {
			sb.WriteRune(c)
		} else {
			sb.WriteRune('_')
		}
	}
	return sb.String()
}

func (cm *CacheManager) ensureCacheDir() error {
	return os.MkdirAll(cm.cacheDir, 0700)
}

func (cm *CacheManager) loadCache() (map[string]CacheEntry, error) {
	cm.mu.RLock()
	if cm.cache != nil {
		cm.mu.RUnlock()
		return cm.cache, nil
	}
	cm.mu.RUnlock()

	cm.mu.Lock()
	defer cm.mu.Unlock()

	if cm.cache != nil {
		return cm.cache, nil
	}

	if err := cm.ensureCacheDir(); err != nil {
		cm.cache = make(map[string]CacheEntry)
		return cm.cache, nil
	}

	if _, err := os.Stat(cm.cacheFile); os.IsNotExist(err) {
		cm.cache = make(map[string]CacheEntry)
		return cm.cache, nil
	}

	data, err := os.ReadFile(cm.cacheFile)
	if err != nil {
		cm.preserveCorruptCache()
		cm.cache = make(map[string]CacheEntry)
		return cm.cache, nil
	}

	var cache map[string]CacheEntry
	if err := json.Unmarshal(data, &cache); err != nil {
		cm.preserveCorruptCache()
		cm.cache = make(map[string]CacheEntry)
		return cm.cache, nil
	}
	cm.cache = cache
	return cm.cache, nil
}

func (cm *CacheManager) preserveCorruptCache() {
	if _, err := os.Stat(cm.cacheFile); os.IsNotExist(err) {
		return
	}
	if _, err := os.Stat(cm.corruptFile); err == nil {
		os.Remove(cm.corruptFile)
	}
	os.Rename(cm.cacheFile, cm.corruptFile)
}

func (cm *CacheManager) saveCache() error {
	cm.mu.RLock()
	if cm.cache == nil {
		cm.mu.RUnlock()
		return nil
	}
	cm.mu.RUnlock()

	cm.mu.Lock()
	defer cm.mu.Unlock()

	if cm.cache == nil {
		return nil
	}

	if err := cm.ensureCacheDir(); err != nil {
		return err
	}

	data, err := json.MarshalIndent(cm.cache, "", "  ")
	if err != nil {
		return err
	}

	if err := os.WriteFile(cm.tmpFile, data, 0600); err != nil {
		return err
	}

	if err := os.Rename(cm.tmpFile, cm.cacheFile); err != nil {
		os.Remove(cm.tmpFile)
		return err
	}
	return nil
}

func (cm *CacheManager) Get(key string) interface{} {
	cache, err := cm.loadCache()
	if err != nil {
		return nil
	}
	entry, ok := cache[key]
	if !ok {
		return nil
	}
	if cm.isExpired(entry) {
		cm.Delete(key)
		return nil
	}
	return entry.Value
}

func (cm *CacheManager) Set(key string, value interface{}) {
	cache, err := cm.loadCache()
	if err != nil {
		return
	}
	cm.mu.Lock()
	cache[key] = CacheEntry{
		Value:    value,
		CachedAt: float64(time.Now().Unix()),
	}
	cm.mu.Unlock()
	cm.saveCache()
}

func (cm *CacheManager) Delete(key string) {
	cache, err := cm.loadCache()
	if err != nil {
		return
	}
	cm.mu.Lock()
	delete(cache, key)
	cm.mu.Unlock()
	cm.saveCache()
}

func (cm *CacheManager) Clear() {
	cm.mu.Lock()
	cm.cache = make(map[string]CacheEntry)
	cm.mu.Unlock()
	cm.saveCache()
}

func (cm *CacheManager) isExpired(entry CacheEntry) bool {
	ttlSeconds := cm.ttlDays * 24 * 60 * 60
	return float64(time.Now().Unix())-entry.CachedAt > float64(ttlSeconds)
}

func (cm *CacheManager) IsValid() bool {
	cache, err := cm.loadCache()
	if err != nil {
		return false
	}
	entry, ok := cache["license_status"]
	if !ok {
		return false
	}
	return !cm.isExpired(entry)
}

func (cm *CacheManager) Exists() bool {
	_, err := os.Stat(cm.cacheFile)
	return err == nil
}

func (cm *CacheManager) GetLicenseStatus() map[string]interface{} {
	val := cm.Get("license_status")
	if val == nil {
		return nil
	}
	result, ok := val.(map[string]interface{})
	if !ok {
		return nil
	}
	return result
}

func (cm *CacheManager) SetLicenseStatus(status map[string]interface{}) {
	cm.Set("license_status", status)
}

func (cm *CacheManager) InvalidateLicenseStatus() {
	cm.Delete("license_status")
}

func (cm *CacheManager) SetOnboardingComplete() {
	cm.Set("onboarding_complete", true)
}

func (cm *CacheManager) IsOnboardingComplete() bool {
	return cm.Get("onboarding_complete") == true
}

func (cm *CacheManager) MarkHasEverActivatedPaidLicense() {
	cm.Set("has_ever_activated_paid_license", true)
}

func (cm *CacheManager) HasEverActivatedPaidLicense() bool {
	return cm.Get("has_ever_activated_paid_license") == true
}
