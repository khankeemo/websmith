using System;
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

        public Client(string apiKey, string secret) : this(apiKey, secret, "${api_url}") { }

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

        public async Task<JsonDocument> BindDevice(string licenseKey, string hardwareId, string deviceName)
        {
            var data = new Dictionary<string, object> { ["action"] = "bind_device", ["license_key"] = licenseKey, ["hardware_id"] = hardwareId, ["device_name"] = deviceName };
            return await PostAsync("/api/v1/license", data);
        }

        public async Task<JsonDocument> GetTrialStatus(string hardwareId)
        {
            var data = new Dictionary<string, object> { ["action"] = "status", ["hardware_id"] = hardwareId };
            return await PostAsync("/api/v1/trial", data);
        }

        public async Task<JsonDocument> GetProducts()
        {
            var data = new Dictionary<string, object> { ["action"] = "list" };
            return await PostAsync("/api/v1/store/products", data);
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
