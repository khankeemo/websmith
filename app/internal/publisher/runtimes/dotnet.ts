import { PublisherContext } from '../index';

export function getDotNetTemplates(context: PublisherContext): Record<string, string> {
  const apiUrl = process.env.WEBSMITH_API_URL || process.env.NEXT_PUBLIC_API_URL || '';
  return {
    'Client.cs': `using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace WebsmithSDK
{
    public class ApiException : Exception
    {
        public int StatusCode { get; }
        public string? ResponseBody { get; }

        public ApiException(string message, int statusCode = 0, string? responseBody = null)
            : base(message)
        {
            StatusCode = statusCode;
            ResponseBody = responseBody;
        }
    }

    public class Client
    {
        private readonly string _apiKey;
        private readonly string _apiUrl;
        private readonly string _secret;
        private readonly HttpClient _httpClient;
        private const int MaxRetries = 3;

        public Client(string apiKey, string secret) : this(apiKey, secret, "${apiUrl}") { }

        public Client(string apiKey, string secret, string apiUrl)
        {
            _apiKey = apiKey;
            _secret = secret;
            _apiUrl = string.IsNullOrEmpty(apiUrl) ? Environment.GetEnvironmentVariable("WEBSMITH_API_URL") ?? "" : apiUrl.TrimEnd('/');
            _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        }

        public async Task<JsonDocument> ValidateLicense(string licenseKey, string hardwareId)
        {
            var data = new Dictionary<string, object> { ["action"] = "validate", ["license_key"] = licenseKey, ["hardware_id"] = hardwareId };
            return await PostAsync("/api/v1/license", data);
        }

        public async Task<JsonDocument> ActivateLicense(string licenseKey, string hardwareId, string deviceName)
        {
            var data = new Dictionary<string, object> { ["action"] = "activate", ["license_key"] = licenseKey, ["hardware_id"] = hardwareId, ["device_name"] = deviceName };
            return await PostAsync("/api/v1/license", data);
        }

        public async Task<JsonDocument> DeactivateLicense(string licenseKey, string hardwareId)
        {
            var data = new Dictionary<string, object> { ["action"] = "deactivate", ["license_key"] = licenseKey, ["hardware_id"] = hardwareId };
            return await PostAsync("/api/v1/license", data);
        }

        public async Task<JsonDocument> RenewLicense(string licenseKey)
        {
            var data = new Dictionary<string, object> { ["action"] = "renew", ["license_key"] = licenseKey };
            return await PostAsync("/api/v1/license", data);
        }

        public async Task<JsonDocument> StartTrial(string customerEmail, string customerName, Dictionary<string, object>? customerData = null)
        {
            var payload = new Dictionary<string, object>
            {
                ["action"] = "start",
                ["customer_email"] = customerEmail,
                ["customer_name"] = customerName ?? ""
            };
            if (customerData != null)
            {
                foreach (var kv in customerData)
                    payload[kv.Key] = kv.Value;
            }
            return await PostAsync("/api/v1/trial", payload);
        }

        public async Task<JsonDocument> CheckTrial(string hardwareId)
        {
            var data = new Dictionary<string, object> { ["action"] = "status", ["hardware_id"] = hardwareId };
            return await PostAsync("/api/v1/trial", data);
        }

        public async Task<JsonDocument> ConvertTrial(string hardwareId, string plan, string customerName, string customerEmail)
        {
            var data = new Dictionary<string, object> { ["action"] = "convert", ["hardware_id"] = hardwareId, ["plan"] = plan, ["customer_name"] = customerName, ["customer_email"] = customerEmail };
            return await PostAsync("/api/v1/trial", data);
        }

        public async Task<JsonDocument> ReplaceHardware(string licenseKey, string oldHardwareId, string newHardwareId)
        {
            var data = new Dictionary<string, object> { ["action"] = "replace_hardware", ["license_key"] = licenseKey, ["old_hardware_id"] = oldHardwareId, ["new_hardware_id"] = newHardwareId };
            return await PostAsync("/api/v1/license", data);
        }

        public async Task<JsonDocument> BindDevice(string licenseKey, string hardwareId, string deviceName)
        {
            var data = new Dictionary<string, object> { ["action"] = "bind_device", ["license_key"] = licenseKey, ["hardware_id"] = hardwareId, ["device_name"] = deviceName };
            return await PostAsync("/api/v1/license", data);
        }

        private async Task<JsonDocument> PostAsync(string endpoint, Dictionary<string, object> data)
        {
            int attempt = 0;
            int delay = 1000;
            while (true)
            {
                try
                {
                    var json = JsonSerializer.Serialize(data);
                    var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
                    var nonce = Guid.NewGuid().ToString("N");
                    var bodyHash = ComputeSha256(json);
                    var message = $"{timestamp}{nonce}{bodyHash}";
                    var signature = ComputeHmacSha256(message, _secret);

                    var content = new StringContent(json, Encoding.UTF8, "application/json");
                    content.Headers.Add("X-API-Key", _apiKey);
                    content.Headers.Add("X-Timestamp", timestamp);
                    content.Headers.Add("X-Nonce", nonce);
                    content.Headers.Add("X-Signature", signature);

                    var response = await _httpClient.PostAsync(_apiUrl + endpoint, content);

                    var responseBody = await response.Content.ReadAsStringAsync();

                    if (!response.IsSuccessStatusCode)
                    {
                        throw new ApiException(
                            $"API request failed with status {(int)response.StatusCode}",
                            (int)response.StatusCode,
                            responseBody);
                    }

                    return JsonDocument.Parse(responseBody);
                }
                catch (ApiException) { throw; }
                catch (Exception) when (attempt < MaxRetries - 1)
                {
                    attempt++;
                    await Task.Delay(delay);
                    delay *= 2;
                }
            }
        }

        private static string ComputeSha256(string value)
        {
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
            return Convert.ToHexStringLower(bytes);
        }

        private static string ComputeHmacSha256(string message, string secret)
        {
            var keyBytes = Encoding.UTF8.GetBytes(secret);
            var messageBytes = Encoding.UTF8.GetBytes(message);
            var hash = HMACSHA256.HashData(keyBytes, messageBytes);
            return Convert.ToHexStringLower(hash);
        }
    }
}
`,
    'HardwareFingerprint.cs': `using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;

namespace WebsmithSDK
{
    public static class HardwareFingerprint
    {
        public static Dictionary<string, object> Generate()
        {
            var components = new List<string>();

            // CPU: processor count + architecture
            var cpu = $"cpu:{Environment.ProcessorCount}:{RuntimeInformation.OSArchitecture}";
            components.Add(cpu);

            // Motherboard: WMI via Win32_BaseBoard on Windows, fallback to OS info
            var motherboard = GetMotherboardInfo();
            components.Add(motherboard);

            // MAC: up to 3 active interfaces, colon-separated
            var macs = new List<string>();
            try
            {
                foreach (var ni in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (ni.OperationalStatus == OperationalStatus.Up)
                    {
                        var mac = ni.GetPhysicalAddress().ToString();
                        if (mac.Length > 0)
                            macs.Add(string.Join(":", Enumerable.Range(0, 6)
                                .Select(i => mac.Substring(i * 2, 2))));
                    }
                }
            }
            catch { /* network info unavailable */ }

            if (macs.Count > 0)
                components.Add("mac:" + string.Join(",", macs.Take(3)));

            // OS version
            components.Add("os:" + Environment.OSVersion);

            var combined = string.Join("|", components);
            using var sha256 = SHA256.Create();
            var fingerprint = Convert.ToHexStringLower(sha256.ComputeHash(Encoding.UTF8.GetBytes(combined)));

            return new Dictionary<string, object>
            {
                ["fingerprint"] = fingerprint,
                ["cpu"] = Environment.ProcessorCount.ToString(),
                ["architecture"] = RuntimeInformation.OSArchitecture.ToString(),
                ["macAddresses"] = macs.Take(3).ToList(),
                ["os"] = Environment.OSVersion.ToString(),
                ["osPlatform"] = RuntimeInformation.OSDescription
            };
        }

        private static string GetMotherboardInfo()
        {
            try
            {
                if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                {
                    var psi = new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = "wmic",
                        Arguments = "baseboard get product,manufacturer /format:csv",
                        RedirectStandardOutput = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    };
                    using var proc = System.Diagnostics.Process.Start(psi);
                    if (proc != null)
                    {
                        var output = proc.StandardOutput.ReadToEnd();
                        proc.WaitForExit(2000);
                        var lines = output.Split(new[] { '\\r', '\\n', '\\r\\n' }, StringSplitOptions.RemoveEmptyEntries);
                        if (lines.Length >= 2)
                        {
                            var parts = lines[1].Split(',');
                            if (parts.Length >= 3)
                                return $"mb:{parts[1].Trim()}:{parts[2].Trim()}";
                        }
                    }
                }
            }
            catch { /* WMI unavailable */ }
            return "mb:unknown";
        }
    }
}
`,
    'CacheManager.cs': `using System;
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
`,
    'LicenseEngine.cs': `using System;
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
            if (File.Exists(_licenseKeyPath))
            {
                _licenseKey = File.ReadAllText(_licenseKeyPath).Trim();
            }
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

        public async Task<JsonDocument> ReplaceHardware(string licenseKey, string newHardwareId)
        {
            var oldHardwareId = _fingerprint["fingerprint"]?.ToString() ?? "";
            var result = await _client.ReplaceHardware(licenseKey, oldHardwareId, newHardwareId);
            if (result.RootElement.TryGetProperty("license", out var license))
                _licenseData = license;
            return result;
        }

        public async Task<JsonDocument> BindDevice(string licenseKey, string hardwareId, string deviceName)
        {
            var result = await _client.BindDevice(licenseKey, hardwareId, deviceName);
            if (result.RootElement.TryGetProperty("license", out var license))
                _licenseData = license;
            return result;
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
`,
    'websmith-sdk.csproj': `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <RootNamespace>WebsmithSDK</RootNamespace>
    <Version>${context.kitVersion}</Version>
    <Description>SDK for ${context.productName}</Description>
    <ImplicitUsings>disable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
</Project>`,
    'README.md': `# ${context.productName} — .NET SDK

## Overview

The .NET SDK provides a production-ready client for the Websmith licensing API.
It includes HMAC-SHA256 request signing, automatic retry with exponential backoff,
hardware fingerprinting, cache management, and a full license engine.

## Installation

1. Add the SDK to your project:

\`\`\`xml
<ProjectReference Include="path/to/websmith-sdk.csproj" />
\`\`\`

2. Place \`config/api-config.json\` in your application root:

\`\`\`json
{
  "apiKey": "your_api_key",
  "secret": "your_hmac_secret",
  "productId": "${context.productId}"
}
\`\`\`

## Usage

### Initialize

\`\`\`csharp
using System.IO;
using System.Text.Json;
using WebsmithSDK;

var config = JsonSerializer.Deserialize<JsonElement>(
    File.ReadAllText("config/api-config.json"));

var apiKey = config.GetProperty("apiKey").GetString()!;
var secret = config.GetProperty("secret").GetString()!;
var productId = config.GetProperty("productId").GetString()!;

var client = new Client(apiKey, secret);
var engine = new LicenseEngine(client, productId);
engine.Initialize();
\`\`\`

### Start Trial

\`\`\`csharp
var trialResult = await engine.StartTrial("user@example.com", "John Doe");
\`\`\`

### Check Trial Status

\`\`\`csharp
var status = await engine.CheckTrial();
\`\`\`

### Convert Trial to License

\`\`\`csharp
var result = await engine.ConvertTrial("premium", "John Doe", "user@example.com");
\`\`\`

### Activate License

\`\`\`csharp
var result = await engine.Activate("LICENSE-KEY-HERE", "My Workstation");
\`\`\`

### Validate License

\`\`\`csharp
if (engine.HasLicenseKey())
{
    var result = await engine.Validate();
    if (engine.IsValid())
        Console.WriteLine("License is valid!");
}
\`\`\`

### Renew License

\`\`\`csharp
var result = await engine.Renew();
\`\`\`

### Replace Hardware

\`\`\`csharp
var newFingerprint = HardwareFingerprint.Generate();
var newHardwareId = newFingerprint["fingerprint"].ToString();
var result = await engine.ReplaceHardware("LICENSE-KEY", newHardwareId);
\`\`\`

### Bind Device

\`\`\`csharp
var fp = HardwareFingerprint.Generate();
var hardwareId = fp["fingerprint"].ToString();
var result = await engine.BindDevice("LICENSE-KEY", hardwareId, "Laptop-2");
\`\`\`

### Deactivate License

\`\`\`csharp
var result = await engine.Deactivate();
\`\`\`

### Get License Info

\`\`\`csharp
var info = engine.GetLicenseInfo();
Console.WriteLine(info.GetProperty("status").GetString());
\`\`\`

## Configuration

| Environment Variable | Description |
|---------------------|-------------|
| \`WEBSMITH_API_URL\` | Base URL for the Websmith API |

Configuration is loaded from \`config/api-config.json\` at the application root.

## Cache

The SDK caches license data to \`~/.websmith/<productId>/\` with a configurable TTL.
Cache entries are written atomically (temp file + rename).

## HMAC-SHA256 Signing

All API requests are signed with HMAC-SHA256 using:
- \`X-API-Key\` — Your API key
- \`X-Timestamp\` — Current Unix timestamp
- \`X-Nonce\` — Unique request identifier
- \`X-Signature\` — HMAC-SHA256 of \`timestamp + nonce + body_hash\`

## Error Handling

The SDK throws \`ApiException\` on non-success HTTP responses with the status code
and response body. Transient errors are automatically retried up to 3 times with
exponential backoff (1s, 2s, 4s).

## Hardware Fingerprint

The fingerprint is a SHA-256 hash of:
1. CPU core count + architecture
2. Motherboard info (WMI on Windows)
3. MAC addresses of active interfaces
4. OS version
`
  };
}
