using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;

namespace WebsmithSDK
{
    public class LicenseEngine
    {
        private readonly Client _client;
        private readonly CacheManager _cache;
        private readonly string _licenseKeyPath;
        private JsonElement _licenseData;
        private readonly Dictionary<string, object> _fingerprint;
        private string? _licenseKey;

        public LicenseEngine(Client client, string productId, int cacheTtlSeconds = 0)
        {
            _client = client;
            _cache = new CacheManager(productId, cacheTtlSeconds);
            _fingerprint = HardwareFingerprint.Generate();
            _licenseKeyPath = Path.Combine(
                Environment.GetEnvironmentVariable("HOME") ?? Environment.GetEnvironmentVariable("USERPROFILE") ?? ".",
                ".websmith", productId, "license_key.txt");
        }

        public void Initialize()
        {
        }

        public async Task<JsonDocument> Validate(string? licenseKey = null)
        {
            var key = licenseKey ?? _licenseKey;
            if (string.IsNullOrEmpty(key))
                throw new InvalidOperationException("No license key provided. Call Initialize() first or pass a key.");

            var deviceId = _fingerprint["fingerprint"]?.ToString() ?? "";
            var result = await _client.ValidateLicense(key, deviceId);
            if (result.RootElement.TryGetProperty("license", out var license))
                _licenseData = license;
            return result;
        }

        public async Task<JsonDocument> Activate(string licenseKey, string deviceName)
        {
            var deviceId = _fingerprint["fingerprint"]?.ToString() ?? "";
            var result = await _client.ActivateLicense(licenseKey, deviceId, deviceName);
            if (result.RootElement.TryGetProperty("license", out var license))
            {
                _licenseData = license;
                _licenseKey = licenseKey;
                await SaveLicenseKey(licenseKey);
            }
            return result;
        }

        public async Task<JsonDocument> Deactivate()
        {
            if (string.IsNullOrEmpty(_licenseKey))
                throw new InvalidOperationException("No license key loaded.");

            var deviceId = _fingerprint["fingerprint"]?.ToString() ?? "";
            var result = await _client.DeactivateLicense(_licenseKey, deviceId);
            if (File.Exists(_licenseKeyPath))
                File.Delete(_licenseKeyPath);
            _licenseKey = null;
            _licenseData = default;
            return result;
        }

        public async Task<JsonDocument> Renew()
        {
            if (string.IsNullOrEmpty(_licenseKey))
                throw new InvalidOperationException("No license key loaded.");

            var result = await _client.RenewLicense(_licenseKey);
            if (result.RootElement.TryGetProperty("license", out var license))
                _licenseData = license;
            return result;
        }

        public async Task<JsonDocument> StartTrial(string email, string customerName, Dictionary<string, object>? customerData = null)
        {
            return await _client.StartTrial(email, customerName, customerData);
        }

        public async Task<JsonDocument> CheckTrial()
        {
            var deviceId = _fingerprint["fingerprint"]?.ToString() ?? "";
            return await _client.CheckTrial(deviceId);
        }

        public async Task<JsonDocument> ConvertTrial(string plan, string customerName, string customerEmail)
        {
            var deviceId = _fingerprint["fingerprint"]?.ToString() ?? "";
            return await _client.ConvertTrial(deviceId, plan, customerName, customerEmail);
        }

        public async Task<JsonDocument> BindDevice(string licenseKey, string hardwareId, string deviceName)
        {
            var result = await _client.BindDevice(licenseKey, hardwareId, deviceName);
            if (result.RootElement.TryGetProperty("license", out var license))
                _licenseData = license;
            return result;
        }

        public Dictionary<string, object> ViewHardwareStatus()
        {
            var currentHw = _fingerprint["fingerprint"]?.ToString() ?? "";
            var validateResult = Validate().Result;
            if (validateResult.RootElement.TryGetProperty("data", out var dataEl) && dataEl.ValueKind == JsonValueKind.Object)
            {
                var registeredHw = dataEl.TryGetProperty("hardware_id", out var hwId) ? hwId.GetString() ?? "" : "";
                return new Dictionary<string, object>
                {
                    ["matched"] = currentHw == registeredHw,
                    ["current_hardware_id"] = currentHw,
                    ["registered_hardware_id"] = registeredHw,
                    ["message"] = "Hardware replacement requires administrator approval. Please contact support."
                };
            }
            return new Dictionary<string, object>
            {
                ["matched"] = false,
                ["current_hardware_id"] = currentHw,
                ["registered_hardware_id"] = "",
                ["message"] = "Hardware replacement requires administrator approval. Please contact support."
            };
        }

        public bool HasLicenseKey()
        {
            return !string.IsNullOrEmpty(_licenseKey);
        }

        public bool IsValid()
        {
            if (_licenseData.ValueKind == JsonValueKind.Undefined) return false;
            if (!_licenseData.TryGetProperty("status", out var status) || status.GetString() != "active") return false;
            if (_licenseData.TryGetProperty("expires_at", out var expiresAt) && expiresAt.ValueKind == JsonValueKind.String)
            {
                if (DateTime.TryParse(expiresAt.GetString(), out var exp) && exp < DateTime.UtcNow) return false;
            }
            return true;
        }

        public JsonElement GetLicenseInfo()
        {
            return _licenseData;
        }

        private async Task SaveLicenseKey(string key)
        {
            var dir = Path.GetDirectoryName(_licenseKeyPath);
            if (!string.IsNullOrEmpty(dir))
                Directory.CreateDirectory(dir);
            await File.WriteAllTextAsync(_licenseKeyPath, key);
        }
    }
}
