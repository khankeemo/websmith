using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;

namespace WebsmithSDK
{
    public class CacheManager
    {
        private readonly string _cacheDir;
        private readonly int _ttlSeconds;

        public CacheManager(string productId, int ttlSeconds = 0)
        {
            _ttlSeconds = ttlSeconds;
            var home = Environment.GetEnvironmentVariable("HOME")
                ?? Environment.GetEnvironmentVariable("USERPROFILE")
                ?? ".";
            _cacheDir = Path.Combine(home, ".websmith", productId);
            Directory.CreateDirectory(_cacheDir);
        }

        public async Task Set(string key, object value)
        {
            var entry = new CacheEntry
            {
                Data = value,
                ExpiresAt = DateTimeOffset.UtcNow.ToUnixTimeSeconds() + _ttlSeconds
            };
            var json = JsonSerializer.Serialize(entry);
            var fileName = SanitizeKey(key);
            var tempPath = Path.Combine(_cacheDir, fileName + ".tmp");
            var finalPath = Path.Combine(_cacheDir, fileName + ".json");

            await File.WriteAllTextAsync(tempPath, json);
            if (File.Exists(finalPath))
                File.Delete(finalPath);
            File.Move(tempPath, finalPath);
        }

        public async Task<T?> Get<T>(string key) where T : class
        {
            var fileName = SanitizeKey(key);
            var path = Path.Combine(_cacheDir, fileName + ".json");
            if (!File.Exists(path))
                return null;

            try
            {
                var json = await File.ReadAllTextAsync(path);
                var entry = JsonSerializer.Deserialize<CacheEntry>(json);
                if (entry == null)
                    return null;

                if (entry.ExpiresAt < DateTimeOffset.UtcNow.ToUnixTimeSeconds())
                {
                    File.Delete(path);
                    return null;
                }

                var data = JsonSerializer.Deserialize<T>(entry.Data.GetRawText());
                return data;
            }
            catch
            {
                return null;
            }
        }

        public void Clear()
        {
            if (Directory.Exists(_cacheDir))
            {
                foreach (var f in Directory.GetFiles(_cacheDir, "*.json"))
                {
                    try { File.Delete(f); } catch { }
                }
            }
        }

        private static string SanitizeKey(string key)
        {
            var invalid = Path.GetInvalidFileNameChars();
            var sb = new System.Text.StringBuilder(key.Length);
            foreach (var c in key)
                sb.Append(invalid.Contains(c) ? '_' : c);
            return sb.ToString();
        }

        private class CacheEntry
        {
            public JsonElement Data { get; set; }
            public long ExpiresAt { get; set; }
        }
    }
}
