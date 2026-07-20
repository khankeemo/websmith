using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace WebsmithSDK;

public class CacheManager
{
    private readonly string _cacheDir;
    private readonly string _cacheFile;
    private readonly string _tmpFile;
    private readonly string _corruptFile;
    private readonly long _ttlMillis;
    private Dictionary<string, CacheEntry>? _cache;

    private class CacheEntry
    {
        [JsonPropertyName("value")]
        public JsonElement? Value { get; set; }

        [JsonPropertyName("cached_at")]
        public long CachedAt { get; set; }
    }

    public CacheManager(JsonDocument config)
    {
        int ttlDays = 0;
        if (config.RootElement.TryGetProperty("offline", out var offline))
        {
            if (offline.TryGetProperty("cache_days", out var cd))
                ttlDays = cd.GetInt32();
        }
        _ttlMillis = ttlDays * 24L * 60L * 60L * 1000L;

        string productId = "";
        if (config.RootElement.TryGetProperty("product", out var product)
            && product.TryGetProperty("id", out var pid))
        {
            productId = pid.GetString() ?? "";
        }
        var safeName = string.Join("_", (productId ?? "unknown").Split(
            Path.GetInvalidFileNameChars(), StringSplitOptions.RemoveEmptyEntries));
        if (string.IsNullOrEmpty(safeName)) safeName = "unknown";

        var home = Environment.GetEnvironmentVariable("HOME")
            ?? Environment.GetEnvironmentVariable("USERPROFILE")
            ?? ".";
        _cacheDir = Path.Combine(home, ".websmith", safeName);
        _cacheFile = Path.Combine(_cacheDir, "cache.json");
        _tmpFile = Path.Combine(_cacheDir, "cache.tmp");
        _corruptFile = Path.Combine(_cacheDir, "cache.corrupt");
        _cache = null;
    }

    public CacheManager() : this(JsonDocument.Parse("{}")) { }

    private void EnsureCacheDir()
    {
        if (!Directory.Exists(_cacheDir))
            Directory.CreateDirectory(_cacheDir);
    }

    private Dictionary<string, CacheEntry> LoadCache()
    {
        if (_cache != null) return _cache;
        EnsureCacheDir();
        if (!File.Exists(_cacheFile))
        {
            _cache = new Dictionary<string, CacheEntry>();
            return _cache;
        }
        try
        {
            var json = File.ReadAllText(_cacheFile);
            var raw = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json);
            _cache = new Dictionary<string, CacheEntry>();
            if (raw != null)
            {
                foreach (var kv in raw)
                {
                    if (kv.Value.ValueKind == JsonValueKind.Object)
                    {
                        try
                        {
                            var entry = JsonSerializer.Deserialize<CacheEntry>(kv.Value.GetRawText());
                            if (entry != null)
                                _cache[kv.Key] = entry;
                        }
                        catch { }
                    }
                }
            }
            return _cache;
        }
        catch
        {
            PreserveCorruptCache();
            _cache = new Dictionary<string, CacheEntry>();
            return _cache;
        }
    }

    private void PreserveCorruptCache()
    {
        if (File.Exists(_cacheFile))
        {
            try
            {
                if (File.Exists(_corruptFile)) File.Delete(_corruptFile);
                File.Move(_cacheFile, _corruptFile);
            }
            catch
            {
                try { File.Delete(_cacheFile); } catch { }
            }
        }
    }

    private void SaveCache()
    {
        if (_cache == null) return;
        EnsureCacheDir();
        try
        {
            var json = JsonSerializer.Serialize(_cache);
            File.WriteAllText(_tmpFile, json);
            if (File.Exists(_cacheFile)) File.Delete(_cacheFile);
            File.Move(_tmpFile, _cacheFile);
        }
        catch
        {
            try { if (File.Exists(_tmpFile)) File.Delete(_tmpFile); } catch { }
        }
    }

    public string? Get(string key)
    {
        var c = LoadCache();
        if (!c.TryGetValue(key, out var entry)) return null;
        if (IsExpired(entry))
        {
            c.Remove(key);
            SaveCache();
            return null;
        }
        return entry.Value?.GetRawText();
    }

    public void Set(string key, object value)
    {
        var c = LoadCache();
        c[key] = new CacheEntry
        {
            Value = JsonSerializer.SerializeToElement(value),
            CachedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        };
        SaveCache();
    }

    public void Remove(string key)
    {
        var c = LoadCache();
        if (c.ContainsKey(key))
        {
            c.Remove(key);
            SaveCache();
        }
    }

    public void Clear()
    {
        _cache = new Dictionary<string, CacheEntry>();
        SaveCache();
    }

    public bool IsValid()
    {
        var c = LoadCache();
        if (!c.TryGetValue("license_status", out var entry)) return false;
        return !IsExpired(entry);
    }

    public bool Exists() => File.Exists(_cacheFile);

    public string? GetLicenseStatus() => Get("license_status");

    public void SetLicenseStatus(string status) => Set("license_status", status);

    public void InvalidateLicenseStatus() => Remove("license_status");

    public void SetOnboardingComplete() => Set("onboarding_complete", true);

    public bool IsOnboardingComplete()
    {
        var val = Get("onboarding_complete");
        return val != null && val == "true";
    }

    private bool IsExpired(CacheEntry entry)
    {
        return (DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - entry.CachedAt) > _ttlMillis;
    }
}
