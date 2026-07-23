<?php
namespace WSD\SDK;

class CacheManager
{
    private array $config;
    private string $productId;
    private string $cacheDir;
    private string $cacheFile;
    private string $tmpFile;
    private string $corruptFile;
    private int $ttlDays;
    private ?array $cache = null;

    public function __construct(array $config)
    {
        $this->config = $config;
        $this->productId = $config['product']['id'] ?? 'unknown';
        $safeName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $this->productId);
        $cacheBase = sys_get_temp_dir() . '/.websmith';
        if (!is_dir($cacheBase)) {
            @mkdir($cacheBase, 0700, true);
        }
        $this->cacheDir = $cacheBase . '/' . $safeName;
        $this->cacheFile = $this->cacheDir . '/cache.json';
        $this->tmpFile = $this->cacheDir . '/cache.tmp';
        $this->corruptFile = $this->cacheDir . '/cache.corrupt';
        $this->ttlDays = $this->getTtl();
    }

    private function getTtl(): int
    {
        $offline = $this->config['offline'] ?? [];
        return (int)($offline['cache_days'] ?? 0);
    }

    private function ensureCacheDir(): void
    {
        if (!is_dir($this->cacheDir)) {
            @mkdir($this->cacheDir, 0700, true);
        }
    }

    private function loadCache(): array
    {
        if ($this->cache !== null) {
            return $this->cache;
        }
        $this->ensureCacheDir();
        if (!file_exists($this->cacheFile)) {
            $this->cache = [];
            return $this->cache;
        }
        $data = @file_get_contents($this->cacheFile);
        if ($data === false) {
            $this->cache = [];
            return $this->cache;
        }
        $decoded = json_decode($data, true);
        if (!is_array($decoded)) {
            $this->preserveCorruptCache();
            $this->cache = [];
            return $this->cache;
        }
        $this->cache = $decoded;
        return $this->cache;
    }

    private function preserveCorruptCache(): void
    {
        if (file_exists($this->cacheFile)) {
            try {
                if (file_exists($this->corruptFile)) {
                    @unlink($this->corruptFile);
                }
                @rename($this->cacheFile, $this->corruptFile);
            } catch (\Throwable $e) {
                @unlink($this->cacheFile);
            }
        }
    }

    private function saveCache(): void
    {
        if ($this->cache === null) {
            return;
        }
        $this->ensureCacheDir();
        $written = @file_put_contents($this->tmpFile, json_encode($this->cache, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);
        if ($written === false) {
            return;
        }
        $renamed = @rename($this->tmpFile, $this->cacheFile);
        if (!$renamed) {
            @unlink($this->tmpFile);
        }
    }

    public function get(string $key): mixed
    {
        $cache = $this->loadCache();
        $entry = $cache[$key] ?? null;
        if ($entry === null) {
            return null;
        }
        if ($this->isEntryExpired($entry)) {
            $this->delete($key);
            return null;
        }
        return $entry['value'] ?? null;
    }

    public function set(string $key, mixed $value): void
    {
        $cache = $this->loadCache();
        $cache[$key] = ['value' => $value, 'cached_at' => time()];
        $this->cache = $cache;
        $this->saveCache();
    }

    public function delete(string $key): void
    {
        $cache = $this->loadCache();
        if (array_key_exists($key, $cache)) {
            unset($cache[$key]);
            $this->cache = $cache;
            $this->saveCache();
        }
    }

    public function clear(): void
    {
        $this->cache = [];
        $this->saveCache();
    }

    private function isEntryExpired(array $entry): bool
    {
        $cachedAt = (int)($entry['cached_at'] ?? 0);
        $ttlSeconds = $this->ttlDays * 24 * 60 * 60;
        return (time() - $cachedAt) > $ttlSeconds;
    }

    public function isValid(): bool
    {
        $cache = $this->loadCache();
        $entry = $cache['license_status'] ?? null;
        if ($entry === null) {
            return false;
        }
        return !$this->isEntryExpired($entry);
    }

    public function exists(): bool
    {
        return file_exists($this->cacheFile);
    }

    public function getLicenseStatus(): ?array
    {
        $value = $this->get('license_status');
        return is_array($value) ? $value : null;
    }

    public function setLicenseStatus(array $status): void
    {
        $this->set('license_status', $status);
    }

    public function invalidateLicenseStatus(): void
    {
        $this->delete('license_status');
    }

    public function setOnboardingComplete(): void
    {
        $cache = $this->loadCache();
        $cache['onboarding_complete'] = ['value' => true, 'cached_at' => time()];
        $this->cache = $cache;
        $this->saveCache();
    }

    public function isOnboardingComplete(): bool
    {
        return $this->get('onboarding_complete') === true;
    }

    public function markHasEverActivatedPaidLicense(): void
    {
        $cache = $this->loadCache();
        $cache['has_ever_activated_paid_license'] = ['value' => true, 'cached_at' => time()];
        $this->cache = $cache;
        $this->saveCache();
    }

    public function hasEverActivatedPaidLicense(): bool
    {
        return $this->get('has_ever_activated_paid_license') === true;
    }
}
