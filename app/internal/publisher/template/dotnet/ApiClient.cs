using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace WebsmithSDK;

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

public class ApiClient
{
    private static readonly HashSet<int> RetryableStatuses = new() { 500, 502, 503, 504 };

    private readonly string _apiKey;
    private readonly string _apiSecret;
    private readonly string _baseUrl;
    private readonly string _apiVersion;
    private readonly string _productId;
    private readonly int _retryCount;
    private readonly int _timeoutMs;
    private readonly HttpClient _httpClient;
    private HardwareDetector _hardware;
    private CacheManager _cache;

    public ApiClient() : this("config/api-config.json") { }

    public ApiClient(string configPath)
    {
        var config = LoadConfigFile(configPath);
        var api = config.GetProperty("api");
        var product = config.GetProperty("product");
        _apiKey = GetJsonString(api, "public_key");
        _apiSecret = GetJsonString(api, "secret");
        var envUrl = Environment.GetEnvironmentVariable("WEBSMITH_API_URL");
        _baseUrl = (envUrl ?? GetJsonString(api, "url")).TrimEnd('/');
        _apiVersion = GetJsonString(api, "version");
        if (string.IsNullOrEmpty(_apiVersion)) _apiVersion = "v1";
        _productId = GetJsonString(product, "id");
        _retryCount = GetJsonInt(api, "retry_count", 3);
        _timeoutMs = GetJsonInt(api, "timeout", 30000);
        _httpClient = new HttpClient { Timeout = TimeSpan.FromMilliseconds(_timeoutMs) };
        _hardware = new HardwareDetector();
        _cache = new CacheManager(config);
    }

    public ApiClient(JsonDocument config, HardwareDetector hardware, CacheManager cache)
    {
        var api = config.RootElement.GetProperty("api");
        _apiKey = GetJsonString(api, "public_key");
        _apiSecret = GetJsonString(api, "secret");
        var envUrl = Environment.GetEnvironmentVariable("WEBSMITH_API_URL");
        _baseUrl = (envUrl ?? GetJsonString(api, "url")).TrimEnd('/');
        _apiVersion = GetJsonString(api, "version");
        if (string.IsNullOrEmpty(_apiVersion)) _apiVersion = "v1";
        _productId = GetJsonString(config.RootElement.GetProperty("product"), "id");
        _retryCount = GetJsonInt(api, "retry_count", 3);
        _timeoutMs = GetJsonInt(api, "timeout", 30000);
        _httpClient = new HttpClient { Timeout = TimeSpan.FromMilliseconds(_timeoutMs) };
        _hardware = hardware;
        _cache = cache;
    }

    public HardwareDetector GetHardware() => _hardware;
    public CacheManager GetCache() => _cache;

    private string GetHardwareId() => _hardware.GetFingerprint();

    private static JsonDocument LoadConfigFile(string path)
    {
        if (File.Exists(path))
        {
            var text = File.ReadAllText(path);
            return JsonDocument.Parse(text);
        }
        var fallback = $$"""
        {
            "api": { "public_key": "", "secret": "", "url": "", "version": "v1", "retry_count": 3, "timeout": 30000 },
            "product": { "id": "" }
        }
        """;
        return JsonDocument.Parse(fallback);
    }

    private static string GetJsonString(JsonElement obj, string key)
    {
        if (obj.ValueKind == JsonValueKind.Object && obj.TryGetProperty(key, out var prop))
        {
            return prop.GetString() ?? "";
        }
        return "";
    }

    private static int GetJsonInt(JsonElement obj, string key, int def)
    {
        if (obj.ValueKind == JsonValueKind.Object && obj.TryGetProperty(key, out var prop))
        {
            try { return prop.GetInt32(); } catch { }
        }
        return def;
    }

    private async Task<JsonDocument> RequestAsync(string endpoint, Dictionary<string, object> data)
    {
        var url = $"{_baseUrl}/api/{_apiVersion}/{endpoint}";
        var apiPath = $"/api/{_apiVersion}/{endpoint}";
        var maxRetries = _retryCount;

        if (!string.IsNullOrEmpty(_productId) && !data.ContainsKey("product_id"))
        {
            data["product_id"] = _productId;
        }

        for (int attempt = 0; attempt <= maxRetries; attempt++)
        {
            try
            {
                var json = JsonSerializer.Serialize(data);
                var timestamp = CryptoUtils.GenerateTimestamp();
                var nonce = CryptoUtils.GenerateNonce();
                var signature = CryptoUtils.SignRequest(json, _apiSecret, timestamp, nonce, "POST", apiPath, "");

                var content = new StringContent(json, Encoding.UTF8, "application/json");
                content.Headers.Add("X-API-Key", _apiKey);
                content.Headers.Add("X-Timestamp", timestamp);
                content.Headers.Add("X-Nonce", nonce);
                content.Headers.Add("X-Signature", signature);

                var response = await _httpClient.PostAsync(url, content);
                var responseBody = await response.Content.ReadAsStringAsync();

                JsonDocument resultDoc;
                try
                {
                    resultDoc = JsonDocument.Parse(responseBody);
                }
                catch
                {
                    var fallback = JsonSerializer.Serialize(new { message = responseBody });
                    resultDoc = JsonDocument.Parse(fallback);
                }

                if ((int)response.StatusCode >= 200 && (int)response.StatusCode < 300)
                {
                    return resultDoc;
                }

                if ((int)response.StatusCode == 429)
                {
                    if (attempt < maxRetries)
                    {
                        await Task.Delay(5000);
                        continue;
                    }
                    throw new ApiException("Rate limit exceeded", 429, responseBody);
                }

                if (RetryableStatuses.Contains((int)response.StatusCode))
                {
                    if (attempt < maxRetries)
                    {
                        await Task.Delay((attempt + 1) * 2000);
                        continue;
                    }
                }

                var root = resultDoc.RootElement;
                var msg = root.TryGetProperty("message", out var m) ? m.GetString()
                    : root.TryGetProperty("error", out var e) ? e.GetString()
                    : $"HTTP {(int)response.StatusCode}";
                throw new ApiException(msg ?? "Request failed", (int)response.StatusCode, responseBody);
            }
            catch (ApiException) { throw; }
            catch (TaskCanceledException)
            {
                if (attempt < maxRetries)
                {
                    await Task.Delay((attempt + 1) * 2000);
                    continue;
                }
                throw new ApiException("Request timeout", 504);
            }
            catch (HttpRequestException ex)
            {
                if (attempt < maxRetries)
                {
                    await Task.Delay((attempt + 1) * 2000);
                    continue;
                }
                throw new ApiException($"Connection error: {ex.Message}", 503);
            }
            catch (Exception ex)
            {
                if (attempt < maxRetries)
                {
                    await Task.Delay((attempt + 1) * 2000);
                    continue;
                }
                throw new ApiException($"Request failed: {ex.Message}", 500);
            }
        }
        throw new ApiException($"Failed after {maxRetries} retries", 500);
    }

    public async Task<JsonDocument> ValidateLicense(string licenseKey, string hardwareId)
    {
        var data = new Dictionary<string, object>
        {
            ["action"] = "validate",
            ["license_key"] = licenseKey,
            ["hardware_id"] = hardwareId
        };
        if (_cache != null && _cache.IsValid())
        {
            var cached = _cache.GetLicenseStatus();
            if (cached != null)
            {
                return JsonDocument.Parse(cached);
            }
        }
        var response = await RequestAsync("license", data);
        if (_cache != null && response.RootElement.TryGetProperty("success", out var s) && s.GetBoolean()
            && response.RootElement.TryGetProperty("data", out var d) && d.TryGetProperty("valid", out var v) && v.GetBoolean())
        {
            _cache.SetLicenseStatus(response.RootElement.GetRawText());
        }
        return response;
    }

    public async Task<JsonDocument> ActivateLicense(string licenseKey, string hardwareId)
    {
        var data = new Dictionary<string, object>
        {
            ["action"] = "activate",
            ["license_key"] = licenseKey,
            ["hardware_id"] = hardwareId
        };
        var response = await RequestAsync("license", data);
        _cache?.InvalidateLicenseStatus();
        return response;
    }

    public async Task<JsonDocument> DeactivateLicense(string licenseKey, string hardwareId)
    {
        var data = new Dictionary<string, object>
        {
            ["action"] = "deactivate",
            ["license_key"] = licenseKey,
            ["hardware_id"] = hardwareId
        };
        var response = await RequestAsync("license", data);
        _cache?.InvalidateLicenseStatus();
        return response;
    }

    public async Task<JsonDocument> RenewLicense(string licenseKey, int? extraDays = null)
    {
        var data = new Dictionary<string, object>
        {
            ["action"] = "renew",
            ["license_key"] = licenseKey
        };
        if (extraDays.HasValue)
        {
            data["extra_days"] = extraDays.Value;
        }
        var response = await RequestAsync("license", data);
        _cache?.InvalidateLicenseStatus();
        return response;
    }

    public async Task<JsonDocument> StartTrial(string email, string customerName, string hardwareId, Dictionary<string, object>? customerData = null)
    {
        var data = new Dictionary<string, object>
        {
            ["action"] = "start",
            ["customer_email"] = email,
            ["customer_name"] = customerName ?? "",
            ["hardware_id"] = hardwareId
        };
        if (customerData != null)
        {
            foreach (var kv in customerData)
                data[kv.Key] = kv.Value;
        }
        return await RequestAsync("trial", data);
    }

    public async Task<JsonDocument> GetTrialStatus(string hardwareId)
    {
        var data = new Dictionary<string, object>
        {
            ["action"] = "status",
            ["hardware_id"] = hardwareId
        };
        return await RequestAsync("trial", data);
    }

    public async Task<JsonDocument> ConvertTrial(string hardwareId, string? plan, string customerName, string customerEmail)
    {
        var data = new Dictionary<string, object>
        {
            ["action"] = "convert",
            ["hardware_id"] = hardwareId
        };
        if (!string.IsNullOrEmpty(plan)) data["plan"] = plan;
        if (!string.IsNullOrEmpty(customerName)) data["customer_name"] = customerName;
        if (!string.IsNullOrEmpty(customerEmail)) data["customer_email"] = customerEmail;
        var response = await RequestAsync("trial", data);
        _cache?.InvalidateLicenseStatus();
        return response;
    }

    public async Task<JsonDocument> ReplaceDevice(string licenseKey, string oldHardwareId, string newHardwareId)
    {
        var data = new Dictionary<string, object>
        {
            ["action"] = "replace",
            ["license_key"] = licenseKey,
            ["old_hardware_id"] = oldHardwareId,
            ["new_hardware_id"] = newHardwareId
        };
        var response = await RequestAsync("device", data);
        _cache?.InvalidateLicenseStatus();
        return response;
    }

    public async Task<JsonDocument> BindDevice(string licenseKey, string hardwareId, string? deviceName = null)
    {
        var data = new Dictionary<string, object>
        {
            ["action"] = "bind",
            ["license_key"] = licenseKey,
            ["hardware_id"] = hardwareId
        };
        if (!string.IsNullOrEmpty(deviceName)) data["device_name"] = deviceName;
        return await RequestAsync("device", data);
    }

    public async Task<JsonDocument> GetProducts()
    {
        var data = new Dictionary<string, object>
        {
            ["action"] = "list"
        };
        if (!string.IsNullOrEmpty(_productId))
            data["product_id"] = _productId;
        try
        {
            return await RequestAsync("store/products", data);
        }
        catch
        {
            return JsonDocument.Parse("{\"success\":false,\"products\":[]}");
        }
    }

    public async Task<JsonDocument> UpdateCustomer(string name, string email, string phone, string hardwareId)
    {
        var data = new Dictionary<string, object>
        {
            ["action"] = "update",
            ["name"] = name,
            ["email"] = email,
            ["mobile"] = phone,
            ["hardware_id"] = hardwareId
        };
        try
        {
            return await RequestAsync("customer/register", data);
        }
        catch (Exception ex)
        {
            return JsonDocument.Parse($"{{\"success\":false,\"error\":\"{ex.Message}\"}}");
        }
    }
}
