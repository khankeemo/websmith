package websmith

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
	Data      interface{} `json:"data"`
	ExpiresAt int64       `json:"expires_at"`
	CreatedAt int64       `json:"created_at"`
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
